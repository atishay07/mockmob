# CUET Question Pipeline Context (Optimized)

## System Overview

The pipeline processes `generation_jobs` and produces CUET-style MCQs.

Flow:
generation_jobs → generateQuestions() → validateAndAlign() → dedup → publish

* Generation uses Gemini Flash Lite models
* Validation uses Gemini Flash models
* Worker processes one job at a time

---

## Critical Problems (ROOT CAUSES)

### 1. Per-Question Validation (MAJOR COST DRIVER)

Each generated question is validated individually.

→ 20 questions = 20 API calls
→ Causes extreme cost inflation

---

### 2. Duplicate Wastage

Duplicate rate ≈ 70%

→ Duplicates are sent to validation
→ Tokens are wasted on useless questions

---

### 3. Low Acceptance Rate

Only ~3–5 out of 20 questions are accepted

→ Effective cost per usable question increases 4–6×

---

### 4. Validation Loop Overhead

Validation includes:

* retries
* model fallback
* cooldown handling

→ Causes hidden extra API calls and delays

---

### 5. Late Deduplication

Duplicates are removed AFTER validation

→ Validation tokens are wasted unnecessarily

---

## Current Architecture

generateQuestions():

* Generates 20–50 questions
* Uses Gemini Flash Lite
* No strong internal deduplication

validateAndAlign():

* Validates ONE question per call
* Uses Gemini Flash
* Includes retry + fallback logic

Worker:

1. Generate batch
2. Loop: validate each question
3. Deduplicate after validation
4. Publish accepted

---

## Constraints

* Minimize API calls and token usage
* Maintain CUET-level quality
* Keep existing schema and publishing system
* Use different models for generation and validation

---

## Target Optimized System

### Required Flow:

1. Generate 30–40 questions (1 API call)
2. Deduplicate BEFORE validation (no LLM)
3. Validate ALL questions in ONE batch (1 API call)
4. Select best 15–20 questions
5. Publish

---

## Optimization Requirements

* Replace per-question validation with batch validation
* Move deduplication BEFORE validation
* Prevent validation retries on same data
* Reduce duplicate generation at source
* Ensure generator and validator use different models

---

## Success Metrics

* Validation calls: 1 per batch (NOT 20)
* Duplicate rate: <10%
* Acceptance rate: ≥60%
* Cost reduction: ≥70%
* Stable output without retry loops

---

## Summary

The current system is inefficient because:

* validation is done per question
* duplicates are processed unnecessarily
* rejection rate is high

The optimized system must:

* reduce API calls
* eliminate duplicate waste
* increase usable output per batch
