# Contributing to AIsReact.com

First off, thank you for considering contributing to `AIsReact.com`. It's people like you that make this open-source project a valuable public resource. Your contributions will help us transparently track and understand the behavior of leading AI models.

This document provides guidelines for contributing to the project. Please read it carefully to ensure a smooth and effective collaboration process.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [How Can I Contribute?](#how-can-i-contribute)
  - [Reporting Bugs](#reporting-bugs)
  - [Suggesting Enhancements](#suggesting-enhancements)
  - [Contributing Content on the Platform](#contributing-content-on-the-platform)
  - [Making Financial & In-Kind Contributions](#making-financial--in-kind-contributions)
  - [Working on an Issue](#working-on-an-issue)
- [Development Setup](#development-setup)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Pull Request Process](#pull-request-process)
- [Styleguides](#styleguides)
  - [Git Commit Messages](#git-commit-messages)
  - [Code Style](#code-style)

## Code of Conduct

This project and everyone participating in it is governed by the [AIsReact.com Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [your-contact-email@aisreact.com].

## How Can I Contribute?

There are many ways to contribute, both technical and non-technical. Every contribution is valuable.

### Reporting Bugs

If you find a bug, please ensure the bug was not already reported by searching on GitHub under [Issues](https://github.com/aisreact/aisreact/issues). If you're unable to find an open issue addressing the problem, open a new one. Be sure to include a **title and clear description**, as much relevant information as possible, and a **code sample or an executable test case** demonstrating the expected behavior that is not occurring.

### Suggesting Enhancements

If you have an idea for an enhancement or a new feature, please open an issue to start a discussion. This allows us to coordinate efforts and ensure that the proposed feature aligns with the project's goals. Please provide a clear description of the feature, its potential benefits, and any implementation ideas you might have.

### Contributing Content on the Platform

The most direct way to contribute is by using the platform itself!

1.  **Submit Events:** Find significant news events and submit them with accurate text/images and a valid source URL.
2.  **Verify Content:** Spend time in the `/verifying` section to help validate the accuracy of submissions from other users. This is a crucial step that powers the entire platform.

### Making Financial & In-Kind Contributions

Our operating costs comes primarily from server hosting and expensive API calls.

#### Monetary Donations

For individual community members who wish to support us financially, you can do so through our official channels. Every donation, no matter the size, helps keep the servers online and the AI analyses running.

- **[Support us on GitHub Sponsors](https://github.com/sponsors/WillyNilsson)**

#### Corporate Sponsorship & API Credits

We welcome partnerships with AI companies, research institutions, and other organizations that align with our mission of transparency.

The most impactful form of corporate contribution is the donation of **API credits**. This directly reduces our primary operational cost and allows us to conduct more analyses, add more models, and ensure the long-term sustainability of the project.

If your organization is interested in providing API credits or discussing other forms of sponsorship, please contact us directly at **sponsorships@aisreact.com**.

### Working on an Issue

If you would like to work on an existing issue, please leave a comment on the issue indicating your interest. This helps us avoid duplication of effort. If you need guidance on where to start, check for issues labeled `good first issue`.

## Development Setup

Ready to start coding? Here’s how to get the project running on your local machine.

### Prerequisites

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) (LTS version recommended)
- [Python](https://www.python.org/) (version 3.8+ recommended)
- [Docker](https://www.docker.com/) (for database, optional but recommended)

### Installation

1.  **Fork and Clone the Repository:**

    ```bash
    git clone https://github.com/your-username/aisreact.git
    cd aisreact
    ```

2.  **Setup Backend (Python):**

    ```bash
    # Navigate to the backend directory
    cd backend

    # Create and activate a virtual environment
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`

    # Install dependencies
    pip install -r requirements.txt
    ```

3.  **Setup Frontend (React/Next.js):**

    ```bash
    # Navigate to the frontend directory from the root
    cd frontend

    # Install dependencies
    npm install
    ```

4.  **Environment Variables:**
    Create a `.env` file in both the `frontend` and `backend` directories by copying from the `.env.example` files. Fill in the necessary API keys and configuration details.

5.  **Run the Application:**
    - **Run Frontend:** `npm run dev` (from the `frontend` directory)
    - **Run Backend:** `uvicorn main:app --reload` (from the `backend` directory)

## Pull Request Process

1.  Ensure any install or build dependencies are removed before the end of the layer when doing a build.
2.  Update the `README.md` with details of changes to the interface, this includes new environment variables, exposed ports, useful file locations, and container parameters.
3.  Create your feature branch: `git checkout -b feature/your-amazing-feature`.
4.  Commit your changes with a clear commit message (see [Git Commit Messages](#git-commit-messages)).
5.  Make sure your code lints and any tests pass.
6.  Push to your forked repository: `git push origin feature/your-amazing-feature`.
7.  Open a [Pull Request](https://github.com/aisreact/aisreact/pulls) to the `main` branch of the `aisreact/aisreact` repository.
8.  Provide a clear description of the changes in the PR description and link to the issue it resolves (e.g., "Closes #37").

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature").
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...").
- Limit the first line to 72 characters or less.
- Reference issues and pull requests liberally after the first line.

### Code Style

- **Frontend (JavaScript/TypeScript):** We use [Prettier](https://prettier.io/) for code formatting. Please run `npm run format` before committing your changes.
- **Backend (Python):** We use [Black](https://github.com/psf/black) for code formatting. Please ensure it is run on your code before committing.
