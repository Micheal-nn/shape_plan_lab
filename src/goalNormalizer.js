function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function roundOne(value) {
  return Math.round(value * 10) / 10;
}

function weeksUntil(targetDate) {
  const today = new Date().toISOString().slice(0, 10);
  const days = Math.max(1, Math.ceil((new Date(targetDate).getTime() - new Date(today).getTime()) / 86400000));
  return Math.max(1, Math.ceil(days / 7));
}

function addAdjustment(adjustments, field, oldValue, newValue, reasonZh, reason) {
  if (oldValue === newValue) return;
  adjustments.push({ field, oldValue, newValue, reasonZh, reason });
}

function setGoalValue(input, adjustments, field, value, reasonZh, reason) {
  const oldValue = input.goal[field];
  input.goal[field] = value;
  addAdjustment(adjustments, `goal.${field}`, oldValue, value, reasonZh, reason);
}

function setGoalType(input, adjustments, value, reasonZh, reason) {
  const oldValue = input.goal.type;
  input.goal.type = value;
  addAdjustment(adjustments, "goal.type", oldValue, value, reasonZh, reason);
}

export function normalizeGoalInput(rawInput) {
  const input = clone(rawInput);
  const adjustments = [];
  const goal = input.goal;
  const bodyFat = input.bodyFatPct;
  const weight = input.weightKg;

  // Resolve incompatible goal types before calculating a sustainable target range.
  if (goal.type === "muscle_gain" && bodyFat !== undefined && goal.targetBodyFatPct !== undefined && goal.targetBodyFatPct < bodyFat) {
    setGoalType(input, adjustments, "recomposition", "增肌与降低体脂率是相互冲突的约束，已改为体态重组以同时保留力量训练和温和能量缺口。", "Muscle gain and lower body fat are conflicting constraints, so this was changed to recomposition.");
  }

  if (goal.type === "recomposition" && goal.targetWeightKg !== undefined && Math.abs(goal.targetWeightKg - weight) > weight * 0.05) {
    const type = goal.targetWeightKg < weight ? "fat_loss" : "muscle_gain";
    setGoalType(input, adjustments, type, "体态重组的体重变化通常较小；已按目标体重方向切换为更匹配的目标类型。", "Recomposition usually involves small weight changes, so the goal type now follows the requested weight direction.");
  }

  if (goal.type === "maintain" && goal.targetWeightKg !== undefined && Math.abs(goal.targetWeightKg - weight) > weight * 0.02) {
    const type = goal.targetWeightKg < weight ? "fat_loss" : "muscle_gain";
    setGoalType(input, adjustments, type, "保持体重不应包含明显体重变化；已按目标体重方向切换目标类型。", "Maintenance should not include material weight change, so the goal type now follows the requested weight direction.");
  }

  if (goal.type === "fat_loss") {
    if (goal.targetWeightKg !== undefined && goal.targetWeightKg >= weight) {
      setGoalValue(input, adjustments, "targetWeightKg", roundOne(weight - Math.max(0.5, weight * 0.02)), "减脂目标的体重必须低于当前体重；已调整为温和且可开始执行的下降目标。", "A fat-loss target weight must be below current weight, so it was changed to a modest, actionable reduction.");
    }
    if (bodyFat !== undefined && goal.targetBodyFatPct !== undefined && goal.targetBodyFatPct >= bodyFat) {
      setGoalValue(input, adjustments, "targetBodyFatPct", roundOne(Math.max(2, bodyFat - Math.max(1, bodyFat * 0.08))), "减脂目标的体脂率必须低于当前体脂率；已调整为温和下降目标。", "A fat-loss body-fat target must be below the current value, so it was changed to a modest reduction.");
    }
  }

  if (goal.type === "muscle_gain") {
    if (goal.targetWeightKg !== undefined && goal.targetWeightKg <= weight) {
      setGoalValue(input, adjustments, "targetWeightKg", roundOne(weight + Math.max(0.5, weight * 0.02)), "增肌目标的体重必须高于当前体重；已调整为温和增长目标。", "A muscle-gain target weight must be above current weight, so it was changed to a modest increase.");
    }
  }

  if (goal.type === "recomposition") {
    if (goal.targetWeightKg !== undefined && Math.abs(goal.targetWeightKg - weight) > weight * 0.05) {
      setGoalValue(input, adjustments, "targetWeightKg", roundOne(weight + Math.sign(goal.targetWeightKg - weight) * weight * 0.05), "体态重组的体重变化应保持在当前体重约 5% 内，已收敛目标体重。", "Recomposition weight change is kept within about 5% of current weight, so the target was narrowed.");
    }
    if (bodyFat !== undefined && goal.targetBodyFatPct !== undefined && goal.targetBodyFatPct >= bodyFat) {
      setGoalValue(input, adjustments, "targetBodyFatPct", roundOne(Math.max(2, bodyFat - 1)), "体态重组以降低体脂率为主，已将目标调整为小幅下降。", "Recomposition is centered on reducing body fat, so the target was changed to a small decrease.");
    }
  }

  if (goal.type === "maintain") {
    if (goal.targetWeightKg !== undefined && Math.abs(goal.targetWeightKg - weight) > weight * 0.02) {
      setGoalValue(input, adjustments, "targetWeightKg", roundOne(weight + Math.sign(goal.targetWeightKg - weight) * weight * 0.02), "保持目标的体重变化应控制在当前体重约 2% 内，已收敛目标体重。", "Maintenance weight change is kept within about 2% of current weight, so the target was narrowed.");
    }
    if (bodyFat !== undefined && goal.targetBodyFatPct !== undefined && Math.abs(goal.targetBodyFatPct - bodyFat) > 2) {
      setGoalValue(input, adjustments, "targetBodyFatPct", roundOne(bodyFat + Math.sign(goal.targetBodyFatPct - bodyFat) * 2), "保持目标的体脂变化应控制在 2 个百分点内，已收敛目标体脂率。", "Maintenance body-fat change is kept within two percentage points, so the target was narrowed.");
    }
  }

  if (goal.targetWeightKg !== undefined && ["fat_loss", "muscle_gain"].includes(goal.type)) {
    const weeks = weeksUntil(goal.targetDate);
    const maxWeeklyChange = goal.type === "fat_loss" ? Math.min(1, weight * 0.007) : Math.min(0.35, weight * 0.0035);
    const maxChange = maxWeeklyChange * weeks;
    const requestedChange = Math.abs(goal.targetWeightKg - weight);
    if (requestedChange > maxChange) {
      const targetWeightKg = roundOne(weight + (goal.type === "fat_loss" ? -maxChange : maxChange));
      setGoalValue(input, adjustments, "targetWeightKg", targetWeightKg, `按当前截止日期，目标变化需要超过每周 ${roundOne(maxWeeklyChange)} kg；已调整至该周期内更安全的可执行范围。`, `The requested timeline requires more than ${roundOne(maxWeeklyChange)} kg per week, so the target was adjusted to a safer achievable range.`);
    }
  }

  const increasingFields = ["chestCm", "hipCm", "armCm", "thighCm"];
  for (const field of ["waistCm", ...increasingFields]) {
    const current = input.currentCircumference?.[field];
    const target = input.goalCircumference?.[field];
    if (current === undefined || target === undefined) continue;
    let corrected = target;
    let reasonZh;
    let reason;
    if (field === "waistCm" && target >= current) {
      corrected = roundOne(current * 0.97);
      reasonZh = "腰围目标需小于当前值；系统不承诺局部减脂，因此调整为可评估的温和缩小目标。";
      reason = "A waist target must be below the current value; no spot-reduction promise is made, so this is a modest measurable reduction.";
    }
    if (increasingFields.includes(field) && target <= current) {
      corrected = roundOne(current * 1.03);
      reasonZh = "该围度的塑形目标应大于当前值；已调整为温和增长目标，并会增加对应肌群训练侧重。";
      reason = "A shaping target for this circumference must be above current value; it was changed to a modest increase with targeted training emphasis.";
    }
    if (Math.abs(corrected - current) > current * 0.2) {
      corrected = roundOne(current * (corrected < current ? 0.8 : 1.2));
      reasonZh = "单个围度一次变化不应超过当前值的 20%；已收敛为阶段性目标。";
      reason = "A single circumference change is limited to 20% of the current value, so this was narrowed into a phased target.";
    }
    if (corrected !== target) {
      input.goalCircumference[field] = corrected;
      addAdjustment(adjustments, `goalCircumference.${field}`, target, corrected, reasonZh, reason);
    }
  }

  return { input, adjustments };
}
