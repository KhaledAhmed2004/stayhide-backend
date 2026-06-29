---
name: skill-optimizer
description:
  Use this skill to continuously improve and refine other skills in the `.agents/` directory.
  Ensures all skills remain token-efficient, aligned with project standards, and up-to-date
  with the latest workflow improvements.
---

# Skill Optimizer

This skill governs the self-improvement loop for all AI-assisted tools and instructions in this project.

## Workflow

### 1. Identify Inefficiencies
*   **Redundancy**: Look for duplicated information across different `.claude/rules/` or `.agents/skills/` files.
*   **Irrelevant Context**: Remove generic examples or instructions that don't apply to the current project's stack (Express, Mongoose, Zod).
*   **Token Waste**: Shorten descriptions and remove filler text without losing critical meaning.

### 2. Alignment with Project Standards
*   **Observability**: Ensure all skills respect the **Auto-Labeling** and **OpenTelemetry** naming conventions (`*Controller`, `*Service`).
*   **Clean Code**: Verify that skills promote [SRP](file:///clean-code.md#L15) and small, descriptive functions.
*   **Documentation**: Ensure skills enforce the [Documentation Update Protocol](file:///documentation-standards.md#L41) and the use of **Bangla** for architecture deep-dives.

### 3. Optimization Steps
1.  **Read**: Analyze the target skill's `SKILL.md` or rule's `.md` file.
2.  **Compare**: Check it against the current project structure and latest [workflow.md](file:///workflow.md).
3.  **Refactor**: Apply the following:
    - Replace generic placeholders with project-specific code snippets.
    - Link to existing project rules (e.g., [route-design.md](file:///route-design.md)) instead of re-explaining them.
    - Use more precise technical language.
4.  **Verify**: Ensure the refactored skill is still accurate and easier for an AI to follow.

### 4. Trigger Points
Perform a skill optimization when:
*   A new project standard is established.
*   The project stack changes (e.g., adding a new major library).
*   An AI tool repeatedly makes the same mistake despite existing rules.
*   The `CLAUDE.md` entry point is updated with new indices.

## Rules for Skill Writing
*   **Origin**: Set `origin: Project` for project-specific skills.
*   **Description**: Keep the frontmatter description concise and action-oriented.
*   **Links**: Use Markdown links with `file:///` for internal references.
*   **Code**: Always provide copy-paste ready examples that match the project's style.
