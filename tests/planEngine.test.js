import test from "node:test";
import assert from "node:assert/strict";
import { generatePlan, reviewAndAdjustPlan } from "../src/planEngine.js";
import { validateGeneratePlanInput } from "../src/validators.js";
import { normalizeGoalInput } from "../src/goalNormalizer.js";

test("normalizeGoalInput corrects target direction conflicts instead of rejecting valid data", () => {
  const input = {
    sex: "male",
    age: 30,
    heightCm: 175,
    weightKg: 80,
    bodyFatPct: 22,
    goal: { type: "muscle_gain", targetDate: "2026-11-30", targetWeightKg: 70, targetBodyFatPct: 18 },
    trainingMode: "gym",
    frequencyPerWeek: 4,
    sessionMinutes: 60
  };
  const errors = validateGeneratePlanInput(input);
  const normalized = normalizeGoalInput(input);

  assert.equal(errors, null);
  assert.equal(normalized.input.goal.type, "fat_loss");
  assert.equal(normalized.input.goal.targetWeightKg, 70);
  assert.equal(normalized.input.goal.targetBodyFatPct, 18);
  assert.ok(normalized.adjustments.some((adjustment) => adjustment.field === "goal.type"));
});

test("normalizeGoalInput narrows an unsafe deadline-driven fat-loss target", () => {
  const normalized = normalizeGoalInput({
    sex: "female", heightCm: 165, weightKg: 72,
    goal: { type: "fat_loss", targetDate: "2026-07-29", targetWeightKg: 60 },
    trainingMode: "bodyweight", frequencyPerWeek: 3
  });

  assert.ok(normalized.input.goal.targetWeightKg > 60);
  assert.ok(normalized.adjustments.some((adjustment) => adjustment.field === "goal.targetWeightKg"));
});

test("validateGeneratePlanInput accepts coherent fat-loss inputs", () => {
  const errors = validateGeneratePlanInput({
    sex: "female",
    age: 28,
    heightCm: 165,
    weightKg: 72,
    bodyFatPct: 31,
    goal: { type: "fat_loss", targetDate: "2026-11-30", targetWeightKg: 65, targetBodyFatPct: 26 },
    trainingMode: "bodyweight",
    frequencyPerWeek: 3,
    sessionMinutes: 45
  });

  assert.equal(errors, null);
});

test("generatePlan creates a feasible fat-loss plan", () => {
  const plan = generatePlan({
    sex: "male",
    age: 30,
    heightCm: 178,
    weightKg: 88,
    bodyFatPct: 24,
    goal: {
      type: "fat_loss",
      targetDate: "2026-12-31",
      targetWeightKg: 80,
      targetBodyFatPct: 17
    },
    trainingMode: "gym",
    frequencyPerWeek: 4,
    sessionMinutes: 60,
    activityLevel: "light"
  });

  assert.equal(plan.feasible, true);
  assert.ok(plan.targets.dailyCalories > 1500);
  assert.equal(plan.trainingPlan.workouts.length, 4);
  assert.equal(plan.trainingPlan.workouts[0].exercises[0].nameZh, "杠铃卧推");
  assert.equal(plan.cardioPlan.sessionsPerWeek, 2);
  assert.equal(plan.cardioPlan.exercises[0].nameZh, "跑步机坡走");
  assert.equal(plan.rationale.length, 5);
  assert.match(plan.planningLogic.feasibilityPath.textZh, /概率判断/);
  assert.equal(plan.planningLogic.evidenceBasis.length, 4);
  assert.equal(plan.intensityPlan.rpe, "7–8");
  assert.ok(plan.trainingPlan.workouts.every((workout) => workout.exercises.every((exercise) => exercise.intensity.rir === "2–3")));
  assert.ok(plan.growthProjection.weekly.length > 8);
});

test("generatePlan flags unrealistic fat-loss rates", () => {
  const plan = generatePlan({
    sex: "female",
    heightCm: 165,
    weightKg: 72,
    goal: {
      type: "fat_loss",
      targetDate: "2026-07-29",
      targetWeightKg: 60
    },
    trainingMode: "bodyweight",
    frequencyPerWeek: 3
  });

  assert.equal(plan.feasible, false);
  assert.match(plan.warnings.join(" "), /1\.0 kg\/week/);
});

test("generatePlan changes calorie target when only the target date changes", () => {
  const base = { sex: "male", heightCm: 175, weightKg: 82, bodyFatPct: 24, goal: { type: "fat_loss", targetWeightKg: 74 }, trainingMode: "gym", frequencyPerWeek: 4 };
  const faster = generatePlan({ ...base, goal: { ...base.goal, targetDate: "2026-09-10" } });
  const slower = generatePlan({ ...base, goal: { ...base.goal, targetDate: "2027-02-10" } });

  assert.ok(faster.targets.dailyCalories < slower.targets.dailyCalories);
});

test("reviewAndAdjustPlan revises a plan when progress is too slow", () => {
  const originalInput = {
    sex: "male",
    heightCm: 175,
    weightKg: 82,
    bodyFatPct: 24,
    goal: {
      type: "fat_loss",
      targetDate: "2026-11-30",
      targetWeightKg: 74,
      targetBodyFatPct: 16
    },
    trainingMode: "gym",
    frequencyPerWeek: 4,
    sessionMinutes: 60
  };

  const plan = generatePlan(originalInput);
  const review = reviewAndAdjustPlan({
    originalInput,
    currentPlan: plan,
    reviewDate: "2026-08-15",
    bodyMetricsHistory: [
      { date: "2026-08-01", weightKg: 82, bodyFatPct: 24, waistCm: 91 },
      { date: "2026-08-08", weightKg: 81.8, bodyFatPct: 23.9, waistCm: 90.8 },
      { date: "2026-08-15", weightKg: 81.7, bodyFatPct: 23.8, waistCm: 90.7 }
    ],
    trainingHistory: [
      { weekStartDate: "2026-08-03", plannedFrequency: 4, completedFrequency: 3 },
      { weekStartDate: "2026-08-10", plannedFrequency: 4, completedFrequency: 2 }
    ],
    nutritionHistory: [
      { date: "2026-08-13", calories: plan.targets.dailyCalories + 120, proteinGrams: 150, fatGrams: 70, carbGrams: 230 },
      { date: "2026-08-14", calories: plan.targets.dailyCalories + 90, proteinGrams: 148, fatGrams: 72, carbGrams: 220 }
    ]
  });

  assert.notEqual(review.reviewResult, "keep_plan");
  assert.ok(Object.keys(review.adjustments).length > 0);
  assert.ok(review.updatedPlan);
  assert.notEqual(review.updatedPlan.targets.dailyCalories, plan.targets.dailyCalories);
  assert.match(review.llmReview.notes.join(" "), /frequency|slower than target/);
});

test("generatePlan prioritizes a supplied single circumference goal", () => {
  const input = {
    sex: "male",
    age: 30,
    heightCm: 178,
    weightKg: 82,
    bodyFatPct: 20,
    goal: { type: "muscle_gain", targetDate: "2026-12-31", targetWeightKg: 85 },
    currentCircumference: { armCm: 34 },
    goalCircumference: { armCm: 36 },
    trainingMode: "gym",
    frequencyPerWeek: 4,
    sessionMinutes: 60
  };
  const plan = generatePlan(input);

  assert.equal(plan.measurementFocus[0].field, "armCm");
  assert.match(plan.planningLogic.inputAssessment.textZh, /臂围目标：34 → 36 cm/);
  assert.match(plan.planningLogic.trainingDecision.textZh, /目标部位/);
  assert.ok(plan.trainingPlan.workouts.some((workout) => workout.exercises.some((exercise) => exercise.muscleGroup === "biceps")));
  assert.ok(plan.trainingPlan.workouts.some((workout) => workout.exercises.some((exercise) => exercise.muscleGroup === "triceps")));
  assert.ok(plan.intensityPlan.targetVolumes.some((volume) => volume.group === "biceps" && volume.sets === 8));
  assert.ok(plan.intensityPlan.targetVolumes.some((volume) => volume.group === "triceps" && volume.sets === 8));
  assert.ok(plan.trainingPlan.workouts.some((workout) => workout.exercises.some((exercise) => exercise.muscleGroup === "biceps" && exercise.emphasis)));
});

test("validateGeneratePlanInput accepts circumference-only fat-loss target", () => {
  const errors = validateGeneratePlanInput({
    sex: "female",
    heightCm: 165,
    weightKg: 70,
    goal: { type: "fat_loss", targetDate: "2026-12-31" },
    currentCircumference: { waistCm: 82 },
    goalCircumference: { waistCm: 77 },
    trainingMode: "bodyweight",
    frequencyPerWeek: 3
  });

  assert.equal(errors, null);
});
