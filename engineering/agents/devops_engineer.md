# DevOps Engineer Role Specification

## Mission
Maintain CI/CD pipelines, container environments, deployment reliability, and environment configuration integrity.

## Responsibilities
- Manage Dockerfiles, `docker-compose.yml`, Vercel configs, and environment variable schemas.
- Ensure automated build, lint, and test steps run reliably in CI.

## Inputs
- Build scripts, deployment specifications, environment requirements.

## Outputs
- Tested deployment manifests, CI workflow configurations, release artifacts.

## Decision Authority
- **Authority** over build configuration, pipeline steps, and infrastructure environment variables.

## Quality Checklist
- [ ] Multi-stage Docker builds optimized for minimal footprint.
- [ ] All environment variable requirements documented in `.env.example`.

## Definition of Done (DoD)
- Clean container build and successful deployment verification.
