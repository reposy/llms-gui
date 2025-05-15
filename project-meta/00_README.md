# Project Documentation (`project-meta`)

Welcome to the `project-meta` directory. This space contains essential documentation for developers, architects, and anyone looking to understand the design, components, and guiding principles of this application.

## Purpose

The documents herein aim to provide a clear, accurate, and maintainable source of truth regarding the project's architecture, core concepts, available node types, and development guides. This documentation is intended to evolve alongside the codebase.

## Navigating the Documentation

To help you find the information you need, the documentation is organized into the following main sections:

### 1. Architecture (`01_ARCHITECTURE/`)

Understand the high-level structure of the application, including its frontend and backend components.

*   **[Architectural Overview](./01_ARCHITECTURE/overview.md)**: Start here for a general understanding of the project's architecture and design philosophy.
*   **[Frontend Architecture](./01_ARCHITECTURE/frontend_architecture.md)**: Details about the React-based frontend.
*   **[Backend Architecture](./01_ARCHITECTURE/backend_architecture.md)**: Details about the FastAPI-based backend, including API design.

### 2. Nodes (`02_NODES/`)

Explore the various node types available in the application, which form the building blocks of workflows.

*   **[Nodes Overview](./02_NODES/overview.md)**: Learn about the general concept of nodes, their common structure, and how to add new ones. This overview also links to detailed documentation for each specific node type available.
    *   *(Individual node files like `html_parser_node.md`, `web_crawler_node.md`, etc., are linked from the overview.)*

### 3. Core Concepts (`03_CONCEPTS/`)

Dive deeper into the fundamental ideas and mechanisms that underpin the project.

*   **[Project Principles](./03_CONCEPTS/project_principles.md)**: The core philosophies (Consistency, Simplicity, Single Entry Point, Maintainability) that guide development.
*   **[Data Flow and Execution](./03_CONCEPTS/data_flow_and_execution.md)**: How data is passed between nodes and how workflows are executed.

### 4. Developer Guides (`04_GUIDES/`)

Practical, step-by-step instructions for common development tasks.

*   **[Adding a New Node Type](./04_GUIDES/adding_new_node.md)**: A comprehensive guide for extending the system with new node functionalities.
*   **[Debugging Node Flows](./04_GUIDES/debugging_flows.md)**: Tips and techniques for troubleshooting workflows.

### 5. Deprecated Documents (`DEPRECATED/`)

This directory contains older versions of documentation that have been superseded by the refactored content in the directories above. They are kept for historical reference if needed but should not be considered current.

---

We encourage contributions to keep this documentation accurate and up-to-date. If you notice any discrepancies or areas for improvement, please feel free to update the relevant files. 