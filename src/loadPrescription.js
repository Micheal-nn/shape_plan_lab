const MAIN_LOAD_BY_GOAL = {
  fat_loss: { bench: 0.72, squat: 0.72, row: 0.7, hinge: 0.72 },
  muscle_gain: { bench: 0.8, squat: 0.78, row: 0.78, hinge: 0.8 },
  recomposition: { bench: 0.76, squat: 0.74, row: 0.74, hinge: 0.76 },
  maintain: { bench: 0.72, squat: 0.72, row: 0.7, hinge: 0.72 }
};

const CATEGORY_ANCHOR = {
  bench: "bench", inclinePress: "bench", shoulderPress: "bench", triceps: "bench", lateralRaise: "bench", pecFly: "bench",
  squat: "squat", gobletSquat: "squat", splitSquat: "squat", calf: "squat",
  hinge: "hinge", hipThrust: "hinge", gluteBridge: "hinge", legCurl: "hinge", carry: "hinge",
  row: "row", pulldown: "row", curl: "row", facePull: "row"
};

const ACCESSORY_FACTOR = {
  bench: 0.74, squat: 0.74, row: 0.72, hinge: 0.74,
  inclinePress: 0.34, shoulderPress: 0.24, triceps: 0.12, lateralRaise: 0.055, pecFly: 0.16,
  gobletSquat: 0.38, splitSquat: 0.28, calf: 0.45,
  hipThrust: 0.58, gluteBridge: 0, legCurl: 0.22, carry: 0.45,
  pulldown: 0.62, curl: 0.16, facePull: 0.12
};

const COMMON_RATIOS = {
  bench: 0.48, inclinePress: 0.18, shoulderPress: 0.16, triceps: 0.11, lateralRaise: 0.055, pecFly: 0.12,
  squat: 0.62, gobletSquat: 0.28, splitSquat: 0.2, calf: 0.32,
  hinge: 0.72, hipThrust: 0.52, gluteBridge: 0, legCurl: 0.16, carry: 0.36,
  row: 0.42, pulldown: 0.35, curl: 0.09, facePull: 0.1
};

const EXERCISE_CATEGORY = {
  bench_press: "bench", db_press: "inclinePress", push_up: "bodyweight", close_push_up: "bodyweight", pike_push_up: "bodyweight",
  barbell_row: "row", lat_pulldown: "pulldown", inverted_row: "bodyweight",
  db_curl: "curl", band_curl: "bandLight", rope_pushdown: "triceps",
  bodyweight_squat: "bodyweight", barbell_squat: "squat", goblet_squat: "gobletSquat",
  single_leg_rdl: "bodyweight", rdl: "hinge", glute_bridge: "gluteBridge", hip_thrust: "hipThrust",
  calf_raise: "calf", plank: "core", dead_bug: "core"
};

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

export function estimateSafeTrainingMax(load, reps) {
  if (!(load > 0 && reps > 0)) return null;
  const cappedReps = Math.min(reps, 5);
  const conservative = load * (1 + cappedReps / 40);
  const safetyCap = reps >= 8 ? load * 1.12 : load * 1.15;
  return roundOne(Math.min(conservative, safetyCap));
}

export function roundToCommonGymLoad(kg, category = "") {
  if (!Number.isFinite(kg) || kg <= 0) return 0;
  const accessory = ["lateralRaise", "curl", "triceps", "pecFly", "facePull"].includes(category);
  const increment = accessory || kg <= 20 ? 1 : 2.5;
  return roundOne(Math.max(increment, Math.round(kg / increment) * increment));
}

export function formatLoadKgLb(kg, category = "") {
  const rounded = roundToCommonGymLoad(kg, category);
  return `${rounded} kg / ${Math.round(rounded * 2.20462)} lb`;
}

export function buildPrAnchors(rawPr = {}) {
  return Object.fromEntries(["bench", "squat", "row", "hinge"].map((key) => {
    const input = rawPr[key] ?? {};
    const safeMax = input.safeTrainingMaxKg ?? estimateSafeTrainingMax(input.weightKg, input.reps);
    return [key, safeMax || null];
  }));
}

function exerciseCategory(exercise) {
  if (exercise.mode === "bodyweight") return "bodyweight";
  if (exercise.muscleGroup === "shoulder" && exercise.id === "db_press") return "shoulderPress";
  return EXERCISE_CATEGORY[exercise.id] ?? exercise.muscleGroup;
}

function commonKg(input, category) {
  const experienceFactor = { novice: 0.82, intermediate: 1, advanced: 1.12 }[input.trainingExperience ?? "novice"] ?? 1;
  const sexFactor = input.sex === "female" ? 0.62 : 1;
  const modeFactor = input.trainingMode === "bodyweight" ? 0.62 : 1;
  const goalFactor = input.goal?.type === "muscle_gain" ? 1.08 : input.goal?.type === "fat_loss" ? 0.9 : 1;
  return (input.weightKg ?? 75) * (COMMON_RATIOS[category] ?? 0.2) * sexFactor * experienceFactor * modeFactor * goalFactor;
}

export function prescribeExerciseLoad(exercise, input) {
  const category = exerciseCategory(exercise);
  if (["bodyweight", "core", "gluteBridge"].includes(category)) {
    return { labelZh: "自重（0 kg / 0 lb）", label: "Bodyweight (0 kg / 0 lb)", kg: 0, basisZh: "该动作用自重或动作难度控制强度。", basis: "This movement uses bodyweight or leverage for intensity." };
  }
  if (category === "bandLight") {
    return { labelZh: "轻弹力带，约 2-5 kg / 4-11 lb", label: "Light band, about 2-5 kg / 4-11 lb", kg: null, basisZh: "弹力带按张力区间处方。", basis: "Band resistance is prescribed as a tension range." };
  }

  const pr = buildPrAnchors(input.pr);
  const anchor = CATEGORY_ANCHOR[category] ?? category;
  const mainFactor = MAIN_LOAD_BY_GOAL[input.goal?.type ?? "recomposition"]?.[anchor] ?? 0.72;
  const factor = ["bench", "squat", "row", "hinge"].includes(category) ? mainFactor : (ACCESSORY_FACTOR[category] ?? 0.25);
  const rawKg = pr[anchor] ? pr[anchor] * factor : commonKg(input, category);
  const roundedKg = roundToCommonGymLoad(rawKg, category);
  const labelZh = formatLoadKgLb(rawKg, category);
  const label = labelZh;
  const basisZh = pr[anchor]
    ? `基于${anchorLabelZh(anchor)}保守安全训练最大值 ${pr[anchor]} kg × ${Math.round(factor * 100)}%，并四舍五入到常见器械重量。`
    : "未填写个人纪录，按性别、体重、训练经验和动作类型估算，并四舍五入到常见器械重量。";
  const basis = pr[anchor]
    ? `Based on conservative ${anchorLabel(anchor)} safe training max ${pr[anchor]} kg × ${Math.round(factor * 100)}%, rounded to a common gym load.`
    : "No personal record entered; estimated from sex, body weight, experience, and movement type, then rounded to a common gym load.";
  return { labelZh, label, kg: roundedKg, basisZh, basis, anchor, factor };
}

function anchorLabelZh(anchor) {
  return { bench: "卧推", squat: "深蹲", row: "划船/下拉", hinge: "硬拉/臀推" }[anchor] ?? anchor;
}

function anchorLabel(anchor) {
  return { bench: "bench", squat: "squat", row: "row/pulldown", hinge: "hinge" }[anchor] ?? anchor;
}
