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

function languageFreeMacro(targets) {
  return `Protein ${targets.proteinG}g | Fat ${targets.fatG}g | Carbohydrate ${targets.carbG}g`;
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
  const waistReductionTarget = measurementFocus(input).some((focus) => focus.field === "waistCm");
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
  if (waistReductionTarget && input.goal.type === "maintain") calories -= 150;
  calories += input.calorieAdjustment ?? 0;

  const proteinG = round(input.weightKg * (input.goal.type === "fat_loss" ? 2.0 : input.goal.type === "muscle_gain" ? 1.8 : 1.6));
  const fatG = round(input.weightKg * (input.goal.type === "fat_loss" ? 0.8 : 0.9));
  const minimumCalories = proteinG * 4 + fatG * 9 + input.weightKg * 4;
  calories = Math.max(round(calories), round(minimumCalories));
  const carbG = Math.max(80, round((calories - proteinG * 4 - fatG * 9) / 4));
  return { dailyCalories: round(calories), proteinG, fatG, carbG };
}

function intensityProfile(input) {
  const experience = input.trainingExperience ?? "novice";
  const rir = experience === "advanced" ? "1–2" : experience === "intermediate" ? "2" : "2–3";
  const rpe = experience === "advanced" ? "8–9" : experience === "intermediate" ? "8" : "7–8";
  return {
    rir,
    rpe,
    progressionZh: `当同一动作所有工作组均达到次数上限，且仍保留 ${rir} 次余力（RIR）时：健身房动作下次加重约 2.5%–5%；自重动作优先增加 1–2 次、放慢离心或提高难度。若动作变形、疼痛或连续两次无法完成下限次数，则不加重并检查恢复。`,
    progression: `When every working set reaches the top of the rep range with ${rir} reps in reserve (RIR), add about 2.5%–5% load in the gym; for bodyweight, add 1–2 reps, slow the eccentric, or choose a harder variation. Do not progress with form breakdown, pain, or two consecutive misses below the rep minimum.`
  };
}

function makeWorkout(label, focus, groups, mode, input, focusGroups) {
  const profile = intensityProfile(input);
  const exercises = pickExercises(groups, mode, input).map((exercise) => {
    const emphasized = focusGroups.includes(exercise.muscleGroup);
    const sets = exercise.sets + (emphasized ? 1 : 0);
    return {
      ...exercise,
      sets,
      emphasis: emphasized,
      intensity: { rir: profile.rir, rpe: profile.rpe, loadGuidanceZh: `选择可在 ${exercise.reps} 次范围内完成、末组仍保留 ${profile.rir} 次余力的负荷。`, loadGuidance: `Choose a load that fits ${exercise.reps} reps while leaving ${profile.rir} reps in reserve on the final set.` }
    };
  });
  return { label, labelZh: label.replace("Day", "第") + " 天", focus, focusZh: translateFocus(focus), exercises };
}

function measurementFocus(input) {
  const current = input.currentCircumference ?? {};
  const target = input.goalCircumference ?? {};
  const rules = [
    { field: "waistCm", group: "core", type: "reduce", titleZh: "腰围目标", title: "Waist target", noteZh: "腰围变化主要依赖总体能量缺口和训练执行，不承诺局部减脂。", note: "Waist change relies on overall energy balance and adherence; spot reduction is not promised." },
    { field: "chestCm", group: "chest", type: "increase", titleZh: "胸围目标", title: "Chest target", noteZh: "增加胸部训练量，并保留背部训练以维持肩带平衡。", note: "Adds chest volume while retaining back work for balanced shoulders." },
    { field: "armCm", group: "biceps", secondary: "triceps", type: "increase", titleZh: "臂围目标", title: "Arm target", noteZh: "增加肱二头和肱三头的直接训练量，围度增长仍依赖渐进超负荷与热量恢复。", note: "Adds direct biceps and triceps work; growth still depends on progressive overload and recovery." },
    { field: "thighCm", group: "quads", secondary: "hamstrings", type: "increase", titleZh: "大腿围目标", title: "Thigh target", noteZh: "增加股四头和腘绳肌训练量，优先复合下肢动作与足够恢复。", note: "Adds quad and hamstring volume with compound lower-body work and recovery." },
    { field: "hipCm", group: "glutes", type: "increase", titleZh: "臀围目标", title: "Hip target", noteZh: "增加臀部训练量，以髋伸动作和下肢复合动作作为主线。", note: "Adds glute volume around hip-extension and compound lower-body movements." }
  ];
  return rules.filter((rule) => current[rule.field] !== undefined && target[rule.field] !== undefined && (rule.type === "reduce" ? target[rule.field] < current[rule.field] : target[rule.field] > current[rule.field]));
}

function translateFocus(focus) {
  const labels = {
    "Full Body A": "全身训练 A", "Full Body B": "全身训练 B", "Full Body C": "全身训练 C",
    "Upper A": "上肢训练 A", "Upper B": "上肢训练 B", "Upper C": "上肢训练 C",
    "Lower A": "下肢训练 A", "Lower B": "下肢训练 B", "Lower C": "下肢训练 C"
  };
  return labels[focus] ?? focus;
}

function buildWorkoutSplit(input) {
  const days = input.frequencyPerWeek ?? 3;
  const focuses = measurementFocus(input);
  const extraGroups = focuses.flatMap((focus) => [focus.group, focus.secondary].filter(Boolean));
  const upperGroups = new Set(["chest", "back", "shoulder", "biceps", "triceps"]);
  const lowerGroups = new Set(["quads", "hamstrings", "glutes", "calves", "core"]);
  const addFocus = (focus, groups) => {
    const eligible = focus.startsWith("Upper")
      ? extraGroups.filter((group) => upperGroups.has(group))
      : focus.startsWith("Lower")
        ? extraGroups.filter((group) => lowerGroups.has(group))
        : extraGroups;
    return [...new Set([...groups, ...eligible])].slice(0, 6);
  };
  const make = (label, focus, groups) => makeWorkout(label, focus, addFocus(focus, groups), input.trainingMode, input, extraGroups);
  if (days <= 2) {
    return {
      split: "full_body_2d",
      workouts: [
        make("Day 1", "Full Body A", ["quads", "chest", "back", "core"]),
        make("Day 2", "Full Body B", ["hamstrings", "glutes", "shoulder", "core"])
      ]
    };
  }
  if (days === 3) {
    return {
      split: "full_body_3d",
      workouts: [
        make("Day 1", "Full Body A", ["quads", "chest", "back", "core"]),
        make("Day 2", "Full Body B", ["hamstrings", "shoulder", "biceps", "core"]),
        make("Day 3", "Full Body C", ["glutes", "chest", "triceps", "calves"])
      ]
    };
  }
  if (days === 5) {
    return {
      split: "upper_lower_full_5d",
      workouts: [
        make("Day 1", "Upper A", ["chest", "back", "shoulder", "triceps"]),
        make("Day 2", "Lower A", ["quads", "hamstrings", "glutes", "core"]),
        make("Day 3", "Upper B", ["back", "chest", "biceps", "shoulder"]),
        make("Day 4", "Lower B", ["glutes", "quads", "calves", "core"]),
        make("Day 5", "Full Body C", ["chest", "back", "glutes", "core"])
      ]
    };
  }
  if (days >= 6) {
    return {
      split: "upper_lower_6d",
      workouts: [
        make("Day 1", "Upper A", ["chest", "back", "shoulder", "triceps"]),
        make("Day 2", "Lower A", ["quads", "hamstrings", "glutes", "core"]),
        make("Day 3", "Upper B", ["back", "chest", "biceps", "shoulder"]),
        make("Day 4", "Lower B", ["glutes", "hamstrings", "quads", "calves"]),
        make("Day 5", "Upper C", ["shoulder", "chest", "back", "biceps", "triceps"]),
        make("Day 6", "Lower C", ["quads", "glutes", "hamstrings", "core"])
      ]
    };
  }
  return {
    split: "upper_lower_4d",
    workouts: [
      make("Day 1", "Upper A", ["chest", "back", "shoulder", "triceps"]),
      make("Day 2", "Lower A", ["quads", "hamstrings", "glutes", "core"]),
      make("Day 3", "Upper B", ["chest", "back", "biceps", "shoulder"]),
      make("Day 4", "Lower B", ["quads", "glutes", "calves", "core"])
    ]
  };
}

function buildIntensityPlan(input, workouts, focuses) {
  const profile = intensityProfile(input);
  const totals = new Map();
  workouts.flatMap((workout) => workout.exercises).forEach((exercise) => {
    totals.set(exercise.muscleGroup, (totals.get(exercise.muscleGroup) ?? 0) + exercise.sets);
  });
  const targetGroups = [...new Set(focuses.flatMap((focus) => [focus.group, focus.secondary].filter(Boolean)))];
  const groupLabels = { chest: ["胸部", "Chest"], back: ["背部", "Back"], shoulder: ["肩部", "Shoulders"], biceps: ["肱二头", "Biceps"], triceps: ["肱三头", "Triceps"], quads: ["股四头", "Quadriceps"], hamstrings: ["腘绳肌", "Hamstrings"], glutes: ["臀部", "Glutes"], core: ["核心", "Core"] };
  const targetVolumes = targetGroups.map((group) => ({ group, groupZh: groupLabels[group]?.[0] ?? group, groupLabel: groupLabels[group]?.[1] ?? group, sets: totals.get(group) ?? 0 }));
  const volumeReasonZh = targetVolumes.length
    ? `围度目标肌群安排为每周 ${targetVolumes.map((item) => `${item.groupZh} ${item.sets} 组`).join("、")}；这些为接近力竭前的工作组，目标是提供足够刺激，同时保留恢复空间。`
    : "主要肌群以均衡训练量覆盖；每组都按接近力竭前的工作组执行，避免仅完成动作而缺少刺激。";
  return {
    rpe: profile.rpe,
    rir: profile.rir,
    targetVolumes,
    volumeReasonZh,
    volumeReason: targetVolumes.length
      ? `Target muscle groups receive ${targetVolumes.map((item) => `${item.groupLabel} ${item.sets} sets/week`).join(", ")}. These are near-failure working sets intended to provide sufficient stimulus while preserving recovery capacity.`
      : "Major muscle groups receive balanced weekly training volume; each working set is performed close enough to effort to create a meaningful stimulus without simply going through the motions.",
    progressionZh: profile.progressionZh,
    progression: profile.progression,
    intensityReasonZh: `当前训练经验为${{ novice: "新手", intermediate: "中级", advanced: "高级" }[input.trainingExperience ?? "novice"]}，工作组采用主观用力等级 ${profile.rpe}，每组结束时保留 ${profile.rir} 次余力。这个强度让动作质量、有效刺激和恢复可兼顾；不要求每组练到失败。`,
    intensityReason: `Training experience is ${{ novice: "novice", intermediate: "intermediate", advanced: "advanced" }[input.trainingExperience ?? "novice"]}. Working sets use RPE ${profile.rpe} (RIR ${profile.rir}) to balance form quality, useful stimulus, and recovery; every set does not need to reach failure.`
  };
}

function buildCardioPlan(input) {
  const waistReductionTarget = measurementFocus(input).some((focus) => focus.field === "waistCm");
  if (input.goal.type === "fat_loss" || waistReductionTarget) {
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

function buildRationale(input, targets, cardioPlan, intensityPlan) {
  const goalLabels = { fat_loss: "减脂", muscle_gain: "增肌", recomposition: "体态重组", maintain: "保持" };
  const activityLabel = { sedentary: "久坐", light: "轻活动", moderate: "中等活动", high: "高活动" }[input.activityLevel ?? "light"];
  const calorieDirection = input.goal.type === "fat_loss" ? "热量缺口" : input.goal.type === "muscle_gain" ? "小幅热量盈余" : input.goal.type === "recomposition" ? "温和热量缺口" : "接近维持热量";
  const proteinReason = input.goal.type === "fat_loss" ? "减脂期提高蛋白质比例，以配合力量训练尽量保留瘦体重。" : input.goal.type === "muscle_gain" ? "蛋白质为肌肉修复和训练后的适应提供原料。" : "蛋白质以稳定肌肉量和提高饱腹感为重点。";
  const focus = measurementFocus(input);
  return [
    { titleZh: "热量为什么这样设定", title: "Why these calories", textZh: `以估算日常消耗为基线，考虑你当前的${activityLabel}活动水平，设置 ${targets.dailyCalories} kcal 的${calorieDirection}。该数值不是“越低越好”，而是在预期变化速度、训练恢复、饥饿感和长期执行之间取平衡；应以每周平均摄入而非单日波动判断是否执行到位。`, text: `${targets.dailyCalories} kcal is based on estimated daily expenditure and your activity level. It balances the intended rate of change with recovery, hunger management, and long-term adherence; judge adherence by weekly averages, not single days.` },
    { titleZh: "宏量营养为什么这样分配", title: "Why these macros", textZh: `每日蛋白质设为 ${targets.proteinG}g。${proteinReason}脂肪保留 ${targets.fatG}g 作为基础摄入，其余热量分给 ${targets.carbG}g 碳水，支持日常活动和训练表现。优先把蛋白质分配到 3–4 餐，并将更多碳水安排在训练前后；这不是强制餐单，而是帮助稳定完成总量的执行策略。`, text: `${targets.proteinG}g protein supports recovery; ${targets.fatG}g fat maintains a baseline intake; remaining calories provide ${targets.carbG}g carbs for training. Spread protein over 3–4 meals and place more carbs around training as an adherence strategy, not a mandatory meal plan.` },
    { titleZh: "力量训练为什么这样安排", title: "Why this strength split", textZh: `你设定每周 ${input.frequencyPerWeek ?? 3} 次、每次约 ${input.sessionMinutes ?? 45} 分钟，计划采用覆盖胸、背、肩、手臂、下肢、臀部和核心的常用动作。每次先练复合动作，再练针对性动作；工作组维持 RPE ${intensityPlan.rpe}（RIR ${intensityPlan.rir}），既接近足够刺激又避免每组力竭影响动作质量和恢复。${intensityPlan.volumeReasonZh} 持续进阶而非频繁更换动作，才是计划能够产生训练适应的关键。`, text: `${input.frequencyPerWeek ?? 3} weekly sessions of about ${input.sessionMinutes ?? 45} minutes use standard movements that cover all major muscle groups. Working sets use RPE ${intensityPlan.rpe} (RIR ${intensityPlan.rir}) to balance effective stimulus with form and recovery.` },
    { titleZh: "有氧为什么这样安排", title: "Why this cardio", textZh: `${cardioPlan.reasonZh} 有氧的角色是补充能量消耗和心肺能力，而不是替代力量训练；疲劳明显、下肢恢复受影响时，应先降低间歇强度或时长，而非继续叠加训练量。`, text: `${cardioPlan.reason} Cardio supplements energy expenditure and cardiovascular fitness rather than replacing strength work; if fatigue or lower-body recovery is impaired, reduce interval intensity or duration first.` },
    { titleZh: "怎样判断计划仍在起作用", title: "How to judge whether it is working", textZh: "每周在相同条件下记录体重、体脂或围度，并记录完成训练次数和平均热量。连续 2 周偏离预期趋势时使用复评：减脂过慢优先检查平均摄入与完成率，下降过快则上调热量；增肌期则检查训练进阶、总热量和恢复。", text: "Record weight, body fat or circumference under comparable weekly conditions along with sessions completed and average calories. If the trend diverges for two consecutive weeks, review the plan: check intake and completion first for slow fat loss, increase calories for overly rapid loss, and check progression, intake, and recovery during muscle gain." },
    ...focus.map((item) => ({ titleZh: `${item.titleZh}如何影响计划`, title: `How the ${item.title} affects the plan`, textZh: item.noteZh, text: item.note }))
  ];
}

function buildPlanningLogic(input, targets, split, focusedMeasurements, intensityPlan) {
  const bmr = round(estimateBmr(input));
  const tdee = round(estimateTdee(input));
  const activityFactor = ACTIVITY_FACTORS[input.activityLevel ?? "light"];
  const targetRate = round(Math.abs(goalRatePerWeek(input)) * 100) / 100;
  const weeks = weeksBetween(new Date().toISOString().slice(0, 10), input.goal.targetDate);
  const calorieDelta = targets.dailyCalories - tdee;
  const weeklyTrainingMinutes = (input.frequencyPerWeek ?? 3) * (input.sessionMinutes ?? 45);
  const goalLabel = { fat_loss: "减脂", muscle_gain: "增肌", recomposition: "体态重组", maintain: "保持" }[input.goal.type];
  const goalLabelEn = { fat_loss: "fat loss", muscle_gain: "muscle gain", recomposition: "body recomposition", maintain: "maintenance" }[input.goal.type];
  const focusSummary = focusedMeasurements.length
    ? focusedMeasurements.map((focus) => `${focus.titleZh}：${input.currentCircumference[focus.field]} → ${input.goalCircumference[focus.field]} cm`).join("；")
    : "未填写成对的围度目标，因此使用全身均衡训练。";
  const focusSummaryEn = focusedMeasurements.length
    ? focusedMeasurements.map((focus) => `${focus.title}: ${input.currentCircumference[focus.field]} to ${input.goalCircumference[focus.field]} cm`).join("; ")
    : "No paired circumference target was entered, so the plan uses balanced full-body training.";
  const splitEn = { full_body_2d: "two full-body sessions per week", full_body_3d: "three full-body sessions per week", upper_lower_4d: "a four-day upper/lower split" }[split.split];
  return {
    inputAssessment: { titleZh: "输入评估", title: "Input assessment", textZh: `目标：${goalLabel}；距目标日期约 ${weeks} 周；每周训练 ${input.frequencyPerWeek ?? 3} 次、约 ${weeklyTrainingMinutes} 分钟。围度优先级：${focusSummary}`, text: `Goal: ${goalLabelEn}; approximately ${weeks} weeks remain; ${input.frequencyPerWeek ?? 3} sessions and about ${weeklyTrainingMinutes} training minutes per week. Circumference priority: ${focusSummaryEn}` },
    calculations: [
      { labelZh: "基础代谢", label: "Basal metabolic rate (BMR)", value: `${bmr} kcal/day`, explanationZh: input.bodyFatPct === undefined ? "使用 Mifflin–St Jeor 公式估算。" : "优先使用 Katch–McArdle 瘦体重公式估算。", explanation: input.bodyFatPct === undefined ? "Estimated with the Mifflin-St Jeor equation." : "Estimated with the Katch-McArdle lean-mass equation when body-fat data are available." },
      { labelZh: "日常总消耗", label: "Estimated daily energy expenditure", value: `${tdee} kcal/day`, explanationZh: `基础代谢乘以 ${activityFactor} 的活动系数。`, explanation: `Basal metabolic rate multiplied by an activity factor of ${activityFactor}.` },
      { labelZh: "计划热量", label: "Planned calories", value: `${targets.dailyCalories} kcal/day`, explanationZh: `相对维持消耗 ${calorieDelta >= 0 ? "+" : ""}${calorieDelta} kcal/天；目标体重对应约 ${targetRate} kg/周的变化速度。日均差额仅用于估算，实际以 2 周以上趋势复评。`, explanation: `${calorieDelta >= 0 ? "+" : ""}${calorieDelta} kcal/day relative to estimated expenditure; the target weight implies about ${targetRate} kg/week. Daily estimates are approximate, so review the trend over at least two weeks.` },
      { labelZh: "宏量营养", label: "Macronutrients", value: languageFreeMacro(targets), explanationZh: "先满足蛋白质与脂肪的基础摄入，再将剩余热量分配给碳水以支持训练表现。", explanation: "Protein and fat minimums are set first, with remaining calories allocated to carbohydrates to support training performance." }
    ],
    trainingDecision: { titleZh: "训练决策", title: "Training decision", textZh: focusedMeasurements.length ? `在 ${split.splitZh} 的基础上，将目标部位对应肌群重复编入训练，并为这些动作增加 1 个工作组。${intensityPlan.volumeReasonZh} 以动作质量、渐进超负荷和恢复作为围度变化的必要条件。` : `采用 ${split.splitZh}，在每周 ${input.frequencyPerWeek ?? 3} 次训练中覆盖主要肌群，工作组目标主观用力等级为 ${intensityPlan.rpe}，每组结束保留 ${intensityPlan.rir} 次余力，并以渐进超负荷推动长期适应。`, text: focusedMeasurements.length ? `Using ${splitEn}, target muscle groups are repeated in the schedule and receive one additional working set per exercise. ${intensityPlan.volumeReason} Movement quality, progressive overload, and recovery are required for circumference change.` : `The plan uses ${splitEn} to cover major muscle groups. Working sets target RPE ${intensityPlan.rpe} (RIR ${intensityPlan.rir}) and use progressive overload to drive long-term adaptation.` },
    intensityDecision: { titleZh: "训练强度与进阶规则", title: "Intensity and progression", textZh: `${intensityPlan.intensityReasonZh} ${intensityPlan.progressionZh}`, text: `${intensityPlan.intensityReason} ${intensityPlan.progression}` },
    feasibilityPath: { titleZh: "为什么当前目标处于可达范围", title: "Why this target is within range", textZh: `目标周期约 ${weeks} 周，对应 ${targetRate || "温和"} kg/周的体重变化估算，且每日热量相对维持为 ${calorieDelta >= 0 ? "+" : ""}${calorieDelta} kcal。系统已将过快的目标收敛到安全范围；若能保持每周训练完成率不低于 ${(input.frequencyPerWeek ?? 3)} 次、热量周平均接近目标、睡眠与恢复基本稳定，则预期趋势有机会在周期内接近目标。这里的“可达”是基于模型与执行前提的概率判断，不是结果保证。`, text: `The target spans about ${weeks} weeks, implies ${targetRate || "a modest"} kg/week of weight change, and uses ${calorieDelta >= 0 ? "+" : ""}${calorieDelta} kcal/day relative to estimated expenditure. Overly aggressive goals are narrowed into a safer range. If weekly session completion stays at or above ${input.frequencyPerWeek ?? 3}, average intake stays near target, and sleep and recovery remain stable, the trend may move toward the target within the period. This is a model-based probability assessment, not a guaranteed outcome.` },
    evidenceBasis: [
      { titleZh: "能量平衡与变化速度", title: "Energy balance and rate of change", textZh: "体重变化的方向由长期摄入与消耗差决定，7700 kcal/kg 仅用于粗略估算，不等同于人体每周严格线性变化。计划将热量差限制在温和范围，并用周平均与连续趋势而非某一天的体重判断进展。", text: "The direction of body-weight change is driven by the long-term difference between intake and expenditure. The 7,700 kcal/kg figure is only a rough estimate, not a precise weekly linear prediction. The plan keeps the energy gap moderate and evaluates weekly averages and trends rather than one day's weight." },
      { titleZh: "蛋白质与力量训练", title: "Protein and resistance training", textZh: "蛋白质按体重设置，并与规律力量训练配合，以支持训练后的肌肉蛋白合成、恢复及减脂期瘦体重保留。总蛋白、总热量和训练刺激同时缺失时，单独提高蛋白质不能替代计划本身。", text: "Protein is set relative to body weight and paired with regular resistance training to support recovery, muscle protein synthesis, and lean-mass retention during fat loss. Protein alone cannot replace adequate energy intake and progressive training stimulus." },
      { titleZh: "渐进超负荷与训练剂量", title: "Progressive overload and training dose", textZh: "肌肉和力量适应需要足够的重复训练刺激，并随着能力提高逐步提高重量、次数或总组数。围度增大目标会提高对应肌群的直接训练比重；腰围变化则主要依赖整体能量平衡，核心训练用于力量与稳定性，不承诺局部减脂。", text: "Muscle and strength adaptation require repeated, sufficient training stimulus and gradual increases in load, repetitions, or total sets. Circumference-growth targets increase direct work for the relevant muscles; waist change relies mainly on overall energy balance, while core work supports strength and stability rather than spot reduction." },
      { titleZh: "个体差异与安全边界", title: "Individual variation and safety limits", textZh: "睡眠、压力、既往训练史、药物、月经周期和测量误差都会影响短期数据。出现持续疲劳、疼痛、异常体重波动或疾病相关风险时，应停止自动加码并寻求医生或注册营养师/教练的个体化建议。", text: "Sleep, stress, training history, medication, menstrual-cycle changes, and measurement error can all affect short-term data. Stop automatically increasing workload and seek individualized advice from a clinician, registered dietitian, or qualified coach if persistent fatigue, pain, unusual weight change, or medical risk occurs." }
    ]
  };
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
  const focusedMeasurements = measurementFocus(input);
  const intensityPlan = buildIntensityPlan(input, split.workouts, focusedMeasurements);
  const cardioPlan = buildCardioPlan(input);
  const warnings = [...feasibility.warnings];
  if ((input.sessionMinutes ?? 45) < 35) warnings.push("Short sessions reduce weekly training volume.");
  if (input.trainingMode === "bodyweight" && input.goal.type === "muscle_gain") warnings.push("Bodyweight-only muscle gain usually progresses more slowly.");

  const splitLabelsZh = {
    full_body_2d: "每周 2 次全身训练",
    full_body_3d: "每周 3 次全身训练",
    upper_lower_4d: "每周 4 次上下肢分化",
    upper_lower_full_5d: "每周 5 次上下肢 + 全身补充",
    upper_lower_6d: "每周 6 次上下肢分化"
  };
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
    planningLogic: buildPlanningLogic(input, targets, { ...split, splitZh: splitLabelsZh[split.split] }, focusedMeasurements, intensityPlan),
    trainingPlan: {
      split: split.split,
      splitZh: splitLabelsZh[split.split],
      days: split.workouts.length,
      workouts: split.workouts
    },
    intensityPlan,
    cardioPlan,
    measurementFocus: focusedMeasurements,
    rationale: buildRationale(input, targets, cardioPlan, intensityPlan),
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
