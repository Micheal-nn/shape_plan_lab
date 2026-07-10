# Shape Plan Lab

Android-first fitness planning MVP with a responsive browser client for fast PC validation. The same zero-dependency Node.js API serves both clients, keeping rule validation and plan generation consistent.

## MVP 1.0

- Generates plans for fat loss, muscle gain, recomposition, and maintenance.
- Validates baseline metrics, target direction, target dates, training frequency, and session duration.
- Rejects conflicting goals, for example muscle gain with a lower target weight or a simultaneous lower body-fat target.
- Calculates daily calories, protein, fat, carbohydrates, weekly strength training, cardio, and a projected body-weight trajectory.
- Includes major muscle groups plus cardio options for gym and bodyweight/home settings.
- Returns Chinese exercise names, target-muscle labels, exercise cues, and rule-based plan rationale.
- Records weekly body metrics, weekly completed training frequency, and daily nutrition inputs for manual plan review.
- Recalculates and returns an `updatedPlan` plus `updatedInput` after review so clients can immediately apply the new version.
- Provides a Chinese/English browser UI and SVG long-image export for sharing a plan.

## Planning Rules

- Target dates affect calorie targets. For the same fat-loss target, a shorter valid timeline produces a larger bounded calorie deficit; a longer timeline produces a milder deficit.
- Fat-loss plans require lower target weight/body fat than current values when those fields are set.
- Muscle-gain plans require a higher target weight and do not allow an accompanying lower body-fat target; use recomposition for that intent.
- Recomposition limits target weight movement to 5% of current body weight and requires a lower body-fat target when body fat is supplied.
- Reviews compare historical body metrics, completed frequency, and nutrition records. They can adjust calories, training frequency, timeline, or goal type.

## Run Locally

Requirements: Node.js 22 or later.

```bash
npm test
npm start
```

Open [http://localhost:3000](http://localhost:3000) to use the PC validation interface.

## API

| Endpoint | Description |
| --- | --- |
| `GET /` | Responsive browser validation interface. |
| `GET /health` | Health check. |
| `POST /api/plan/generate` | Validates inputs and generates a rule-based plan. |
| `POST /api/plan/review` | Reviews historical data and returns `updatedInput` and `updatedPlan`. |

### Generate a Plan

```bash
curl -X POST http://localhost:3000/api/plan/generate \
  -H 'Content-Type: application/json' \
  -d '{
    "sex": "male",
    "heightCm": 175,
    "weightKg": 82,
    "bodyFatPct": 24,
    "goal": {
      "type": "fat_loss",
      "targetDate": "2026-11-30",
      "targetWeightKg": 74,
      "targetBodyFatPct": 16
    },
    "trainingMode": "gym",
    "frequencyPerWeek": 4,
    "sessionMinutes": 60
  }'
```

## Test

```bash
npm test
```

The test suite covers target-direction validation, feasible and infeasible plans, target-date-sensitive calorie calculations, cardio/Chinese plan output, and history-based re-planning.

## Safety Boundary

This is a planning and educational product, not a medical diagnosis tool. Users with medical conditions, pregnancy, eating-disorder risk, postoperative recovery needs, or who are minors should consult qualified professionals before following a plan.
