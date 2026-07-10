import { pickCardio, pickExercises } from "./exerciseLibrary.js";

const KCAL_PER_KG = 7700;
const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725
};

function round(value) {
  return Math.round(value);
}

function daysBetween(startIso, endIso) {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  return Math.max(1, Math.ceil((end - start) / 86400000));
}

function weeksBetween(startIso, endIso) {
  return Math.max(1, Math.ceil(daysBetween(startIso, endIso) / 7));
}

function leanMass(weightKg, bodyFatPct) {
  if (bodyFatPct === undefined) return null;
  return weightKg * (1 - bodyFatPct / 100);
}

export function estimateBmr(input) {
  const age = input.age ?? 26;
  const lm = leanMass(input.weightKg, input.bodyFatPct);
  if (lm) return 370 + 21.6 * lm;
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * age;
  return input.sex === "male" ? base + 5 : base - 161;
}

export function estimateTdee(input) {
  return estimateBmr(input) * ACTIVITY_FACTORS[input.activityLevel ?? "light"];
}

function goalRatePerWeek(input) {
  const today = new Date().toISOString().slice(0, 10);
  const weeks = weeksBetween(today, input.goal.targetDate);
  if (input.goal.targetWeightKg === undefined) return 0;
  if (input.goal.type === "fat_loss") return (input.weightKg - input.goal.targetWeightKg) / weeks;
  if (input.goal.type === "muscle_gain") return (input.goal.targetWeightKg - input.weightKg) / weeks;
  return 0;
}

function evaluateFeasibility(input) {
  const warnings = [];
  const frequency = input.frequencyPerWeek ?? 3;
  const rate = goalRatePerWeek(input);

  if (input.goal.type === "fat_loss" && rate > 1.0) {
    warnings.push("Required fat-loss rate exceeds 1.0 kg/week. Extend timeline or reduce target.");
  }
  if (input.goal.type === "muscle_gain" && frequency < 3) {
    warnings.push("Muscle-gain mode with fewer than 3 sessions/week is unlikely to deliver visible progress.");
  }
  if (input.goal.type === "muscle_gain" && rate > 0.35) {
    warnings.push("Requested muscle-gain rate is aggressive. Expect higher fat-gain risk.");
  }
  if (input.goal.targetBodyFatPct !== undefined) {
    const lowerBound = input.sex === "male" ? 8 : 16;
    if (input.goal.targetBodyFatPct < lowerBound) {
      warnings.push("Target body-fat level is very lean for a general-fitness plan.");
    }
  }

  return {
    feasible: !warnings.some((warning) => warning.includes("exceeds 1.0 kg/week")),
    warnings,
    confidence: warnings.length === 0 ? "high" : warnings.length === 1 ? "medium" : "low"
  };
}

function buildTargets(input) {
  const tdee = estimateTdee(input);
  const bodyFatHigh = (input.bodyFatPct ?? 0) >= (input.sex === "male" ? 20 : 30);
  const requestedWeeklyRate = Math.abs(goalRatePerWeek(input));
  let calories = tdee;
  if (input.goal.type === "fat_loss") {
    const requestedDeficit = requestedWeeklyRate > 0 ? (requestedWeeklyRate * KCAL_PER_KG) / 7 : bodyFatHigh ? 600 : 450;
    calories -= Math.min(800, Math.max(250, requestedDeficit));
  }
  if (input.goal.type === "muscle_gain") {
    const requestedSurplus = requestedWeeklyRate > 0 ? (requestedWeeklyRate * KCAL_PER_KG) / (7 * 0.6) : bodyFatHigh ? 100 : 250;
    calories += Math.min(300, Math.max(100, requestedSurplus));
  }
  if (input.goal.type === "recomposition") calories -= bodyFatHigh ? 250 : 100;
  calories += input.calorieAdjustment ?? 0;

  const proteinG = round(input.weightKg * (input.goal.type === "fat_loss" ? 2.0 : input.goal.type === "muscle_gain" ? 1.8 : 1.6));
  const fatG = round(input.weightKg * (input.goal.type === "fat_loss" ? 0.8 : 0.9));
  const minimumCalories = proteinG * 4 + fatG * 9 + input.weightKg * 4;
  calories = Math.max(round(calories), round(minimumCalories));
  const carbG = Math.max(80, round((calories - proteinG * 4 - fatG * 9) / 4));
  return { dailyCalories: round(calories), proteinG, fatG, carbG };
}

function makeWorkout(label, focus, groups, mode) {
  return { label, labelZh: label.replace("Day", "第") + " 天", focus, focusZh: translateFocus(focus), exercises: pickExercises(groups, mode) };
}

function translateFocus(focus) {
  const labels = {
    "Full Body A": "全身训练 A", "Full Body B": "全身训练 B", "Full Body C": "全身训练 C",
    "Upper A": "上肢训练 A", "Upper B": "上肢训练 B", "Lower A": "下肢训练 A", "Lower B": "下肢训练 B"
  };
  return labels[focus] ?? focus;
}

function buildWorkoutSplit(input) {
  const days = input.frequencyPerWeek ?? 3;
  if (days <= 2) {
    return {
      split: "full_body_2d",
      workouts: [
        makeWorkout("Day 1", "Full Body A", ["quads", "chest", "back", "core"], input.trainingMode),
        makeWorkout("Day 2", "Full Body B", ["hamstrings", "glutes", "shoulder", "core"], input.trainingMode)
      ]
    };
  }
  if (days === 3) {
    return {
      split: "full_body_3d",
      workouts: [
        makeWorkout("Day 1", "Full Body A", ["quads", "chest", "back", "core"], input.trainingMode),
        makeWorkout("Day 2", "Full Body B", ["hamstrings", "shoulder", "biceps", "core"], input.trainingMode),
        makeWorkout("Day 3", "Full Body C", ["glutes", "chest", "triceps", "calves"], input.trainingMode)
      ]
    };
  }
  return {
    split: "upper_lower_4d",
    workouts: [
      makeWorkout("Day 1", "Upper A", ["chest", "back", "shoulder", "triceps"], input.trainingMode),
      makeWorkout("Day 2", "Lower A", ["quads", "hamstrings", "glutes", "core"], input.trainingMode),
      makeWorkout("Day 3", "Upper B", ["chest", "back", "biceps", "shoulder"], input.trainingMode),
      makeWorkout("Day 4", "Lower B", ["quads", "glutes", "calves", "core"], input.trainingMode)
    ]
  };
}

function buildCardioPlan(input) {
  if (input.goal.type === "fat_loss") {
    return {
      titleZh: "有氧训练安排", title: "Cardio plan", reasonZh: "减脂期加入低冲击有氧，帮助提高每周能量消耗，同时保留力量训练以尽量维持瘦体重。", reason: "Low-impact cardio raises weekly energy expenditure while preserving strength work to help retain lean mass.",
      sessionsPerWeek: 2, exercises: [pickCardio("lowImpact", input.trainingMode), pickCardio("intervals", input.trainingMode)]
    };
  }
  if (input.goal.type === "recomposition") {
    return {
      titleZh: "有氧训练安排", title: "Cardio plan", reasonZh: "体态重组采用适量低冲击有氧，避免过多有氧挤占力量训练和恢复资源。", reason: "Moderate low-impact cardio supports body recomposition without taking excessive recovery resources from strength training.",
      sessionsPerWeek: 1, exercises: [pickCardio("lowImpact", input.trainingMode)]
    };
  }
  if (input.goal.type === "muscle_gain") {
    return {
      titleZh: "有氧训练安排", title: "Cardio plan", reasonZh: "增肌期只保留少量低强度有氧，用于心肺健康和恢复，不让额外消耗影响热量盈余。", reason: "A small amount of low-intensity cardio supports cardiovascular health without undermining the calorie surplus.",
      sessionsPerWeek: 1, exercises: [{ ...pickCardio("lowImpact", input.trainingMode), durationMinutes: 20 }]
    };
  }
  return {
    titleZh: "有氧训练安排", title: "Cardio plan", reasonZh: "保持期采用适量低冲击有氧，兼顾心肺健康和体重稳定。", reason: "Moderate low-impact cardio supports cardiovascular fitness and stable body weight.",
    sessionsPerWeek: 2, exercises: [pickCardio("lowImpact", input.trainingMode)]
  };
}

function buildRationale(input, targets, cardioPlan) {
  const goalLabels = { fat_loss: "减脂", muscle_gain: "增肌", recomposition: "体态重组", maintain: "保持" };
  const activityLabel = { sedentary: "久坐", light: "轻活动", moderate: "中等活动", high: "高活动" }[input.activityLevel ?? "light"];
  const calorieDirection = input.goal.type === "fat_loss" ? "热量缺口" : input.goal.type === "muscle_gain" ? "小幅热量盈余" : input.goal.type === "recomposition" ? "温和热量缺口" : "接近维持热量";
  const proteinReason = input.goal.type === "fat_loss" ? "减脂期提高蛋白质比例，以配合力量训练尽量保留瘦体重。" : input.goal.type === "muscle_gain" ? "蛋白质为肌肉修复和训练后的适应提供原料。" : "蛋白质以稳定肌肉量和提高饱腹感为重点。";
  return [
    { titleZh: "热量为什么这样设定", title: "Why these calories", textZh: `以估算日常消耗为基线，考虑你当前的${activityLabel}活动水平，设置 ${targets.dailyCalories} kcal 的${calorieDirection}，服务于${goalLabels[input.goal.type]}而非追求短期极端变化。`, text: `${targets.dailyCalories} kcal is based on estimated daily expenditure and your activity level, with a calorie direction matched to your selected goal and target date.` },
    { titleZh: "宏量营养为什么这样分配", title: "Why these macros", textZh: `每日蛋白质设为 ${targets.proteinG}g。${proteinReason}脂肪保留 ${targets.fatG}g 作为基础摄入，其余热量分给 ${targets.carbG}g 碳水，支持日常活动和训练表现。`, text: `${targets.proteinG}g protein supports recovery; ${targets.fatG}g fat maintains a baseline intake; remaining calories provide ${targets.carbG}g carbs for activity and training.` },
    { titleZh: "力量训练为什么这样安排", title: "Why this strength split", textZh: `你设定每周 ${input.frequencyPerWeek ?? 3} 次、每次约 ${input.sessionMinutes ?? 45} 分钟，计划采用覆盖胸、背、肩、手臂、下肢、臀部和核心的常用动作，优先保证动作标准和逐步进阶。`, text: `${input.frequencyPerWeek ?? 3} weekly sessions of about ${input.sessionMinutes ?? 45} minutes use standard movements covering all major muscle groups, prioritizing technique and progressive overload.` },
    { titleZh: "有氧为什么这样安排", title: "Why this cardio", textZh: cardioPlan.reasonZh, text: cardioPlan.reason }
  ];
}

function projectedWeeklyDeltaKg(input, targets) {
  const tdee = estimateTdee(input);
  const dailyDelta = targets.dailyCalories - tdee;
  if (input.goal.type === "fat_loss") return -Math.abs((dailyDelta * 7) / KCAL_PER_KG);
  if (input.goal.type === "muscle_gain") return Math.abs((dailyDelta * 7) / KCAL_PER_KG) * 0.6;
  return (dailyDelta * 7) / KCAL_PER_KG * 0.3;
}

function projectGrowth(input, targets) {
  const today = new Date().toISOString().slice(0, 10);
  const weeks = weeksBetween(today, input.goal.targetDate);
  const weeklyDelta = projectedWeeklyDeltaKg(input, targets);
  return Array.from({ length: weeks }, (_, index) => {
    const week = index + 1;
    const weightKg = round((input.weightKg + weeklyDelta * week) * 10) / 10;
    const bodyFatPct = input.bodyFatPct === undefined
      ? undefined
      : round((input.bodyFatPct + (input.goal.type === "fat_loss" ? -0.18 : input.goal.type === "muscle_gain" ? 0.05 : -0.08) * week) * 10) / 10;
    return { week, weightKg, bodyFatPct };
  });
}

function ruleReview(plan, notes) {
  if (plan.targets.dailyCalories < 1200) {
    return { status: "blocked", notes: [...notes, "Calorie target falls below the hard safety floor."] };
  }
  if (notes.length > 0) return { status: "passed_with_notes", notes };
  return { status: "passed", notes: ["Rule-based secondary review found no material conflicts."] };
}

export function generatePlan(input) {
  const feasibility = evaluateFeasibility(input);
  const targets = buildTargets(input);
  const split = buildWorkoutSplit(input);
  const cardioPlan = buildCardioPlan(input);
  const warnings = [...feasibility.warnings];
  if ((input.sessionMinutes ?? 45) < 35) warnings.push("Short sessions reduce weekly training volume.");
  if (input.trainingMode === "bodyweight" && input.goal.type === "muscle_gain") warnings.push("Bodyweight-only muscle gain usually progresses more slowly.");

  const plan = {
    feasible: feasibility.feasible,
    confidence: feasibility.confidence,
    summary: feasibility.feasible
      ? warnings.length > 0
        ? "Plan is usable with caution. Review warnings before starting."
        : `Plan is feasible and optimized for sustainable ${input.goal.type.replace("_", " ")}.`
      : `Current ${input.goal.type} target is not realistic under the selected deadline or frequency.`,
    summaryZh: feasibility.feasible
      ? warnings.length > 0
        ? "当前计划可以执行，但请先阅读风险提示并确认约束条件。"
        : `当前时间、频率和目标相互匹配，计划按可持续${{ fat_loss: "减脂", muscle_gain: "增肌", recomposition: "体态重组", maintain: "保持" }[input.goal.type]}路径生成。`
      : "当前目标与截止日期或训练频率不匹配，建议先调整约束条件。",
    targets,
    trainingPlan: {
      split: split.split,
      splitZh: { full_body_2d: "每周 2 次全身训练", full_body_3d: "每周 3 次全身训练", upper_lower_4d: "每周 4 次上下肢分化" }[split.split],
      days: input.frequencyPerWeek ?? 3,
      workouts: split.workouts
    },
    cardioPlan,
    rationale: buildRationale(input, targets, cardioPlan),
    growthProjection: {
      weekly: projectGrowth(input, targets)
    },
    warnings,
    assumptions: [
      `Assumes ${input.frequencyPerWeek ?? 3} sessions per week.`,
      `Assumes ${input.activityLevel ?? "light"} daily activity.`,
      "Assumes the user follows calorie targets within a reasonable weekly average."
    ],
    llmReview: { status: "passed", notes: [] }
  };
  plan.llmReview = ruleReview(plan, warnings.slice(0, 2));
  return plan;
}

function average(items, selector) {
  return items.length === 0 ? 0 : items.reduce((sum, item) => sum + selector(item), 0) / items.length;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function extendTimeline(targetDate, extraWeeks) {
  const date = new Date(targetDate);
  date.setDate(date.getDate() + extraWeeks * 7);
  return date.toISOString().slice(0, 10);
}

export function reviewAndAdjustPlan(input) {
  const original = clone(input.originalInput);
  const updated = clone(input.originalInput);
  const firstMetric = input.bodyMetricsHistory[0];
  const latestMetric = input.bodyMetricsHistory.at(-1);
  const avgCompletedFrequency = average(input.trainingHistory, (item) => item.completedFrequency);
  const avgCalories = average(input.nutritionHistory, (item) => item.calories);
  const adjustments = {};
  const notes = [];
  let reviewResult = "keep_plan";

  if (latestMetric) {
    updated.weightKg = latestMetric.weightKg;
    if (latestMetric.bodyFatPct !== undefined) updated.bodyFatPct = latestMetric.bodyFatPct;
  }

  if (firstMetric && latestMetric && updated.goal.type === "fat_loss") {
    const observedLossPerWeek = (firstMetric.weightKg - latestMetric.weightKg) / Math.max(1, input.bodyMetricsHistory.length - 1);
    const targetLossPerWeek = Math.max(0, goalRatePerWeek(original));

    if (targetLossPerWeek > 0 && observedLossPerWeek < targetLossPerWeek * 0.5) {
      adjustments.dailyCalories = { old: input.currentPlan.targets.dailyCalories, new: Math.max(1200, input.currentPlan.targets.dailyCalories - 100) };
      notes.push("Observed fat-loss pace is slower than target.");
      reviewResult = "adjust_targets";
    }
    if (targetLossPerWeek > 0 && observedLossPerWeek > targetLossPerWeek * 1.5) {
      adjustments.dailyCalories = { old: input.currentPlan.targets.dailyCalories, new: input.currentPlan.targets.dailyCalories + 100 };
      notes.push("Observed weight loss is faster than planned and may be harder to sustain.");
      reviewResult = "adjust_targets";
    }
  }

  if (avgCompletedFrequency < (original.frequencyPerWeek ?? 3) - 0.5) {
    updated.frequencyPerWeek = Math.max(2, Math.round(avgCompletedFrequency));
    adjustments.frequencyPerWeek = { old: original.frequencyPerWeek ?? 3, new: updated.frequencyPerWeek };
    notes.push("Actual training frequency is below the original assumption.");
    if (reviewResult === "keep_plan") reviewResult = "adjust_targets";
  }

  if (avgCompletedFrequency < (original.frequencyPerWeek ?? 3) - 1) {
    updated.goal.targetDate = extendTimeline(original.goal.targetDate, 2);
    adjustments.timeline = { old: original.goal.targetDate, new: updated.goal.targetDate };
    notes.push("Timeline is extended to match recent completion capacity.");
    if (reviewResult === "keep_plan") reviewResult = "adjust_timeline";
  }

  if (updated.goal.type === "muscle_gain" && avgCompletedFrequency < 3) {
    updated.goal.type = "recomposition";
    adjustments.goalType = { old: original.goal.type, new: updated.goal.type };
    notes.push("Recent training frequency is too low for an efficient muscle-gain phase.");
    reviewResult = "adjust_goal";
  }

  if (avgCalories > 0 && Math.abs(avgCalories - input.currentPlan.targets.dailyCalories) > 250) {
    notes.push("Recorded calorie intake materially differs from the current target.");
  }

  let regenerated = generatePlan(updated);
  if (adjustments.dailyCalories) {
    updated.calorieAdjustment = adjustments.dailyCalories.new - regenerated.targets.dailyCalories;
    regenerated = generatePlan(updated);
    adjustments.dailyCalories.new = regenerated.targets.dailyCalories;
  }
  return {
    reviewResult,
    feasible: regenerated.feasible,
    summary:
      reviewResult === "keep_plan"
        ? "Current plan remains achievable under recent execution data."
        : `Plan has been recomputed from historical data: ${notes.join(" ")}`,
    summaryZh:
      reviewResult === "keep_plan"
        ? "近期真实执行数据仍支持当前计划，暂不需要修改关键目标。"
        : `系统已根据历史数据重新计算计划：${notes.join(" ")}`,
    adjustments,
    updatedInput: updated,
    updatedPlan: regenerated,
    refreshedProjection: regenerated.growthProjection,
    llmReview: {
      status: regenerated.feasible ? "passed_with_notes" : "needs_regeneration",
      notes: notes.length > 0 ? notes : ["Historical data does not require material changes yet."]
    }
  };
}
