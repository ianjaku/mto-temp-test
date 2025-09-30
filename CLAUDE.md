# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

This is a Yarn workspace monorepo with multiple services and clients. Always run commands from the appropriate workspace directory.

### Root Commands
- `yarn lint` - ESLint across entire monorepo (zero warnings policy)
- `yarn mto` / `yarn mtutil` - Access development utilities
- `yarn mto:build` - Build the mtutil development tools

### Service Development (Backend)
Each service (binders-*-service-v*/app/) follows this pattern:
- `npm run dev` - Development with nodemon + TypeScript watch
- `npm run dev:esbuild` - Faster development with ESBuild
- `npm run transpile` - Production build (ESLint + TypeScript)
- `npm run transpile:esbuild` - Faster build with ESBuild
- `npm run lint` - ESLint for source files
- `npm start` - Start production server
- `npm run unittest` - Jest unit tests
- `npm run componenttest` - Component tests
- `npm run integrationtest` - Integration tests

### Client Development (Frontend)
Client workspaces (*/client/) use:
- `npm run dev:webpack` - Webpack development server
- `npm run build:webpack` - Production webpack build
- `npm run lint` - ESLint
- `npm run unittest` - Jest tests
- `npm run unittest:watch` - Jest in watch mode

### Testing
- **Acceptance Testing**: `cd acceptance-testing && npm test` (Jest scenarios)
- **Playwright E2E**: `cd acceptance-testing && npm run pw` (full browser tests)
- **Unit Tests**: Each workspace has `npm run unittest`
- **Component Tests**: Available in services with `npm run componenttest`
- **Integration Tests**: Available in services with `npm run integrationtest`
- **Watch Mode**: Run tests in watch mode with `npm run unittest:watch`

### Key Development Services
- **Repository Service**: `binders-repository-service-v3/app/` (port 8008) - Document management
- **Account Service**: `binders-account-service-v1/app/` (port 8000) - User accounts
- **Authorization Service**: `binders-authorization-service-v1/app/` (port 8003) - Permissions
- **Editor Client**: `binders-editor-service-v2/client/` (port 3010) - Content editor
- **ManualTo Client**: `manualto-service-v1/client/` - Reader experience

## Architecture Overview

### Microservices Backend
- **Framework**: Express.js with TypeScript
- **Pattern**: Independent microservices (account, repo, auth, user, tracking, image, etc.)
- **Databases**: MongoDB (primary), Elasticsearch (search), Redis (cache/sessions)
- **Infrastructure**: Azure blob storage, Docker/Kubernetes deployment
- **Ports**: Services run on 8000+ (account=8000, repo=8008, auth=8003, user=8004)

### Frontend Applications
- **Framework**: React 16.14.0 with TypeScript
- **State Management**: Flux pattern with Zustand (newer) and React Query
- **Routing**: React Router v5
- **Build**: Webpack 5 with custom configurations
- **Styling**: Stylus-based component library

### Shared Libraries
- **binders-client-v1**: API clients, utilities, React hooks, type definitions
- **binders-ui-kit**: React component library with Stylus styling
- **binders-service-common-v1**: Backend middleware, auth, database abstractions

### WebData Pattern
The frontend uses a WebData pattern for API state management:
- **NOT_ASKED**: Request not initiated
- **PENDING**: Request in progress
- **SUCCESS**: Request completed successfully
- **FAILURE**: Request failed

Use `wrapAction()` for API calls and `WebDataComponent` for rendering.

### Configuration
- **Config System**: Centralized `BindersConfig` with environment overrides
- **TypeScript Paths**: Configured in `tsconfig.base.json` for monorepo imports
- **Development**: Uses `.env` file for local configuration

### Development Workflow
1. **Services**: Run `npm run dev` in service directories for hot reloading
2. **Clients**: Use `npm run dev:webpack` for frontend development
3. **Shared Libraries**: Changes require rebuilding dependent services
4. **Testing**: Use individual service tests + acceptance-testing for E2E

### Workspace Dependencies
- Use `workspace:*` for internal package dependencies
- Shared dependencies are hoisted to the root level
- Some packages have version resolutions for compatibility

### Build Process
- Services use TypeScript compilation (`tsc --skipLibCheck`)
- Clients use Webpack with Babel for React/TypeScript
- Production builds set `NODE_ENV=production`
- Development uses `nodemon` for services and `webpack --watch` for clients
- Production builds are optimized and minified

### Key Files
- **Service Entry**: Each service has `src/main.ts` as the Express server entry point
- **Client Entry**: React applications typically have `src/index.tsx`
- **Shared Types**: Common interfaces in `binders-client-v1/src/`
- **UI Components**: Reusable components in `binders-ui-kit/src/`

### TypeScript Configuration
- **Base config**: `tsconfig.base.json`
- **Client config**: `tsconfig.client.json`
- **Service config**: `tsconfig.service.json`
- Each workspace has its own `tsconfig.json` extending the appropriate base

### Development Tools
- **mtutil**: Interactive CLI tool for development tasks
- **Nodemon**: Auto-restart for service development
- **Webpack**: Module bundling with hot reload for clients
- **TSC**: TypeScript compilation for services

### Infrastructure Dependencies
When developing locally, ensure these services are running:
- **MongoDB**: Document storage (port 27017)
- **Elasticsearch**: Search functionality (port 9200)
- **Redis**: Sessions and caching (port 6379)

### Coding guidelines
- Always use types, never introduce the `any` type. You can typecheck and check for other typescript errors by running the command `yarn workspace <THE_WORKSPACE> tsc --noEmit`
- Never do typecasting by first typecasting to `unknown`. This typically indicates a type missmatch or typing error.
- We are using eslint, see our .eslintrc file in the root of the repository. All code added to the repository should adhere to the eslint rules defined there. Run eslint by invoking `yarn workspace <THE_WORKSPACE> eslint`
- Use double quotes for strings in TypeScript/JavaScript code

The application is a content management platform supporting document creation, collaboration, translation, and publishing with separate editor and reader experiences.