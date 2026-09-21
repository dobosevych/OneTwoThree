# Meetings App — local Docker Compose workflow and AWS deployment (CloudFormation).
# Run `make` or `make help` to list targets.

SHELL := /bin/bash
.DEFAULT_GOAL := help

# .env holds compose settings and AWS credentials (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
# AWS_REGION, optionally AWS_SESSION_TOKEN). Only the keys defined in .env are exported.
-include .env
export $(shell sed -n 's/^\([A-Za-z_][A-Za-z0-9_]*\)=.*/\1/p' .env 2>/dev/null)

# ---------------------------------------------------------------------------
# Settings (override on the command line, e.g. `make aws-backend-deploy ARCH=amd64`)
# ---------------------------------------------------------------------------
PROJECT     ?= meetings
AWS_REGION  ?= eu-central-1
export AWS_REGION
export AWS_DEFAULT_REGION := $(AWS_REGION)

# arm64 (Graviton, cheaper; native on Apple Silicon) or amd64
ARCH        ?= arm64
TAG         ?= $(shell git describe --always --dirty 2>/dev/null || date +%Y%m%d%H%M%S)

BACKEND_ECR_STACK := $(PROJECT)-backend-ecr
BACKEND_STACK     := $(PROJECT)-backend
DB_PASSWORD_PARAM := /$(PROJECT)/db/password
BACKEND_PARAMS    := infra/backend.params.env

CFN_ARCH     = $(if $(filter arm64,$(ARCH)),ARM64,X86_64)
HASH        := \#
# $(shell) does not inherit exported variables in GNU make < 4.4 (macOS ships 3.81),
# so AWS lookups inside $(shell) load .env themselves.
AWS_SHELL   := set -a; [ -f .env ] && . ./.env; set +a; aws --region $(AWS_REGION)
# Recursive (=) so they are looked up only when a recipe needs them, after the stacks exist.
ECR_URI      = $(shell $(AWS_SHELL) cloudformation describe-stacks --stack-name $(BACKEND_ECR_STACK) \
                 --query "Stacks[0].Outputs[?OutputKey=='RepositoryUri'].OutputValue" --output text)
ECR_REGISTRY = $(firstword $(subst /, ,$(ECR_URI)))
BACKEND_PARAMS_ARGS = $(shell [ -f $(BACKEND_PARAMS) ] && grep -v -e '^[[:space:]]*$(HASH)' -e '^[[:space:]]*$$' $(BACKEND_PARAMS))
backend_output = $(shell $(AWS_SHELL) cloudformation describe-stacks --stack-name $(BACKEND_STACK) \
                 --query "Stacks[0].Outputs[?OutputKey=='$(1)'].OutputValue" --output text)

TEST_DB_URL := postgresql+psycopg://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@localhost:$(or $(DB_PORT),5432)/meetings_test

##@ Local (Docker Compose)

.env:
	cp .env.example .env
	@echo "Created .env from .env.example — review it (ports, AWS credentials)."

.PHONY: up
up: .env ## Build and start db, backend and frontend (http://localhost:$FRONTEND_PORT)
	docker compose up -d --build --wait
	@echo "App: http://localhost:$(or $(FRONTEND_PORT),3000)   API docs: http://localhost:$(or $(FRONTEND_PORT),3000)/api/docs"

.PHONY: down
down: ## Stop all containers (data is kept)
	docker compose down

.PHONY: clean
clean: ## Stop containers and delete the database volume
	docker compose down -v --remove-orphans

.PHONY: restart
restart: down up ## Restart the stack

.PHONY: logs
logs: ## Follow logs of all services (SERVICE=backend to narrow)
	docker compose logs -f $(SERVICE)

.PHONY: ps
ps: ## Show container status
	docker compose ps

##@ Quality

.PHONY: test
test: test-back test-front ## Run all tests

.PHONY: test-back
test-back: .env ## Backend tests (starts the db container, creates meetings_test)
	docker compose up -d --wait db
	docker compose exec -T db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -tAc \
	  "SELECT 1 FROM pg_database WHERE datname = 'meetings_test'" | grep -q 1 || \
	  docker compose exec -T db psql -U $(POSTGRES_USER) -d $(POSTGRES_DB) -c "CREATE DATABASE meetings_test"
	cd back && TEST_DATABASE_URL=$(TEST_DB_URL) uv run pytest -q

.PHONY: test-front
test-front: ## Frontend tests
	cd front && npm test

.PHONY: lint
lint: ## Code style checks (same as CI)
	cd back && uv run ruff check . && uv run ruff format --check .
	cd front && npm run lint && npm run format:check && npm run typecheck
	uvx cfn-lint infra/*.yaml

.PHONY: format
format: ## Auto-format backend and frontend
	cd back && uv run ruff check --fix . && uv run ruff format .
	cd front && npm run format

##@ AWS backend (ECS Fargate + RDS via CloudFormation)

.PHONY: aws-check
aws-check: ## Verify AWS credentials from .env work
	@aws sts get-caller-identity --query '[Account, Arn]' --output text \
	  || { echo "AWS credentials missing/invalid: set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION in .env"; exit 1; }

.PHONY: aws-backend-deploy
aws-backend-deploy: aws-check aws-backend-ecr aws-backend-db-password aws-backend-push aws-backend-stack ## Deploy backend: ECR, image, RDS, Fargate service
	@echo
	@echo "API:      $(call backend_output,ApiUrl)"
	@echo "API docs: $(call backend_output,ApiDocsUrl)"

.PHONY: aws-backend-ecr
aws-backend-ecr: ## Create/update the ECR repository stack
	aws cloudformation deploy --stack-name $(BACKEND_ECR_STACK) --template-file infra/backend-ecr.yaml \
	  --parameter-overrides Project=$(PROJECT) --no-fail-on-empty-changeset

.PHONY: aws-backend-db-password
aws-backend-db-password: ## Create the DB password in SSM Parameter Store (once; never overwritten)
	@aws ssm get-parameter --name $(DB_PASSWORD_PARAM) >/dev/null 2>&1 \
	  && echo "SSM parameter $(DB_PASSWORD_PARAM) already exists" \
	  || { aws ssm put-parameter --name $(DB_PASSWORD_PARAM) --type SecureString \
	         --value "$$(openssl rand -hex 24)" >/dev/null && echo "Created SSM parameter $(DB_PASSWORD_PARAM)"; }

.PHONY: aws-backend-login
aws-backend-login: ## Log Docker in to ECR
	@test -n "$(ECR_URI)" || { echo "ECR repository not found: run \`make aws-backend-ecr\` first (and check AWS credentials in .env)"; exit 1; }
	aws ecr get-login-password | docker login --username AWS --password-stdin $(ECR_REGISTRY)

.PHONY: aws-backend-push
aws-backend-push: aws-backend-login ## Build the backend image for linux/$(ARCH) and push it with tag $(TAG)
	docker buildx build --platform linux/$(ARCH) --provenance=false \
	  -t $(ECR_URI):$(TAG) -t $(ECR_URI):latest --push back

.PHONY: aws-backend-stack
aws-backend-stack: ## Create/update the backend stack (VPC, RDS, ALB, ECS) with image tag $(TAG)
	@test -n "$(ECR_URI)" || { echo "ECR repository not found: run \`make aws-backend-ecr\` first (and check AWS credentials in .env)"; exit 1; }
	aws cloudformation deploy --stack-name $(BACKEND_STACK) --template-file infra/backend.yaml \
	  --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset \
	  --parameter-overrides Project=$(PROJECT) ImageUri=$(ECR_URI):$(TAG) \
	    CpuArchitecture=$(CFN_ARCH) DbPasswordParameter=$(DB_PASSWORD_PARAM) $(BACKEND_PARAMS_ARGS)

.PHONY: aws-backend-outputs
aws-backend-outputs: ## Show backend stack outputs (API URL, DB endpoint, ...)
	@aws cloudformation describe-stacks --stack-name $(BACKEND_STACK) \
	  --query "Stacks[0].Outputs[].[OutputKey, OutputValue]" --output table

.PHONY: aws-backend-status
aws-backend-status: ## Show ECS service status and recent events
	@aws ecs describe-services --cluster $(PROJECT) --services $(PROJECT)-backend \
	  --query "services[0].{status:status, running:runningCount, desired:desiredCount, events:events[:5].message}" \
	  --output yaml

.PHONY: aws-backend-logs
aws-backend-logs: ## Tail backend logs from CloudWatch
	aws logs tail /ecs/$(PROJECT)-backend --follow --since 30m

.PHONY: aws-backend-redeploy
aws-backend-redeploy: ## Restart backend tasks without changing the image
	aws ecs update-service --cluster $(PROJECT) --service $(PROJECT)-backend --force-new-deployment \
	  --query "service.deployments[0].rolloutState" --output text

.PHONY: aws-backend-destroy
aws-backend-destroy: aws-check ## Delete backend stacks (a final RDS snapshot is kept)
	@read -p "Delete stacks $(BACKEND_STACK) and $(BACKEND_ECR_STACK) in $(AWS_REGION)? [y/N] " ok && [ "$$ok" = y ]
	aws cloudformation delete-stack --stack-name $(BACKEND_STACK)
	aws cloudformation wait stack-delete-complete --stack-name $(BACKEND_STACK)
	aws cloudformation delete-stack --stack-name $(BACKEND_ECR_STACK)
	aws cloudformation wait stack-delete-complete --stack-name $(BACKEND_ECR_STACK)
	aws ssm delete-parameter --name $(DB_PASSWORD_PARAM) || true
	@echo "Done. Remove the final snapshot with: aws rds describe-db-snapshots --snapshot-type manual"

##@ AWS (all parts)

.PHONY: aws-deploy
aws-deploy: aws-backend-deploy ## Deploy everything (backend today; add frontend here later)

.PHONY: aws-destroy
aws-destroy: aws-backend-destroy ## Delete everything on AWS

##@ Help

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*##"; printf "Usage: make \033[36m<target>\033[0m\n"} \
	  /^[a-zA-Z_.-]+:.*?##/ { printf "  \033[36m%-24s\033[0m %s\n", $$1, $$2 } \
	  /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) }' $(MAKEFILE_LIST)
