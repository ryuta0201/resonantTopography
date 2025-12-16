# Resonant Topography

This project visualizes a personal exploration algorithm inspired by
Bayesian optimization, spiral search, and cenote-like convergence.

## Core Concepts
- Fog: diffuse sampling / uncertainty
- Net: structured relational stability
- Fluid (Cenote): dissolution and reorganization into flow

## Conceptual Model

**Resonant Topography** is a visual and computational model of *personal exploration*
inspired by Bayesian optimization, embodied cognition, and relational dynamics.

Rather than optimizing toward a single solution, the system explores how **structure emerges, stabilizes, dissolves, and re-forms** through continuous transitions.

The model is composed of three primary phases, blended *continuously* rather than switched discretely.

---

### 1. Fog — Diffuse Presence / Uncertainty

**Fog** represents the state before structure appears.

* Nodes exist as **points with presence**, not yet meaningfully related
* Motion is driven by stochastic noise (Brownian-like exploration)
* There is no stable topology, only *sampling*
* Conceptually:

  * Uncertainty
  * Open exploration
  * Pre-conceptual awareness
  * “膜が張られる前の点の存在感”

This phase corresponds to the *exploration* side of Bayesian optimization:
probing the space without commitment.

---

### 2. Net — Relational Structure / Stability

**Net** represents the emergence of structure through relationships.

* Nodes attract and repel locally, forming a **constellation-like network**
* Connections stabilize without collapsing into isolated clusters
* Structure is *maintained*, not frozen
* Conceptually:

  * Meaning through relation
  * Cognitive maps
  * Stable yet flexible understanding
  * “構造の安定（島化しない）”

This phase reflects exploitation and relational inference:
patterns become visible, but remain adaptable.

---

### 3. Fluid (Cenote) — Dissolution / Reorganization

**Fluid** represents the dissolution of explicit structure into flow.

* Lines dissolve; particles grow and merge visually
* Global vortex forces dominate over local structure
* Occasional inversion of gravity introduces *creative disruption*
* Conceptually:

  * Deconstruction of knowledge
  * Childlike freedom
  * Reorganization rather than collapse
  * “線が溶け、粒子が合流する”

This phase is not chaos for its own sake.
It is a **necessary forgetting** that allows new structures to emerge.

---

### Continuous Transition (No Discrete Switching)

A key principle of this model is that **phases are not toggled**, but *blended*.

A continuous parameter `t ∈ [0, 2]` controls the system:

* Fog weight decreases from `t = 0 → 1`
* Net peaks at `t = 1`
* Fluid increases from `t = 1 → 2`

Each physical force and visual behavior is weighted by these phase values, producing smooth transitions rather than abrupt mode changes.

This reflects lived cognition more accurately than digital state machines.

---

### Why Randomized Fluid Gravity?

Each transition into (or out of) the Fluid phase randomizes the fluid gravity profile.

* Most of the time: gentle attraction toward a center
* Occasionally: strong repulsion instead of attraction

This models the idea that **reorganization is not predictable**.
Sometimes insight converges; sometimes it explodes outward.

---

### Status & Future Directions

Current implementation uses **p5.js** for embodied, real-time exploration.

Future expansions may include:

* Semantic similarity
* Resonance metrics
* Revisit frequency
* Data-driven nodes
* Migration to higher-performance or data-centric environments

For now, this project prioritizes *felt correctness* over data completeness.

---

This is not a visualization of answers.

It is a visualization of **how understanding moves**.


## Status
Prototype (p5.js)

## Next
- Phase-weight blending refinement
- Fluid profile randomization
- Documentation of conceptual model
