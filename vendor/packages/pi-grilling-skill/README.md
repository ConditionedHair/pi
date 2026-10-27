# pi-grilling-skill

Grill the user relentlessly about a plan, decision, or idea.

This package provides a `grilling` skill that interviews you about your plan one question at a time, walking down each branch of the decision tree until you reach a shared understanding — before any action is taken.

## What it does

When invoked, the skill will:

- Interview you about every aspect of the plan or idea, resolving dependencies between decisions one-by-one
- Ask one question at a time, waiting for your answer before continuing
- Offer a recommended answer for each question it asks
- Look up facts from the environment (filesystem, tools, etc.) instead of asking you, reserving questions for genuine decisions
- Hold off on acting until you've confirmed a shared understanding

## Installation

`pi install npm:pi-grilling-skill`

## Usage

Trigger the skill with a "grill" phrase, e.g.:

```
grill me on this plan
```

The skill will then interview you step-by-step until your plan or decision is fully stress-tested.

## License

Apache-2.0
