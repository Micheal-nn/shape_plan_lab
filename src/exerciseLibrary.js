const library = {
  chest: [
    { id: "push_up", name: "Push-Up", nameZh: "俯卧撑", muscleGroup: "chest", muscleGroupZh: "胸部", mode: "bodyweight", sets: 3, reps: "8-15", restSeconds: 60, descriptionZh: "保持躯干稳定，下放至胸部接近地面后推起。" },
    { id: "bench_press", name: "Bench Press", nameZh: "杠铃卧推", muscleGroup: "chest", muscleGroupZh: "胸部", mode: "gym", sets: 4, reps: "5-8", restSeconds: 120, descriptionZh: "肩胛后收下沉，控制杠铃触胸后推起，避免耸肩。" }
  ],
  back: [
    { id: "inverted_row", name: "Inverted Row", nameZh: "反向划船", muscleGroup: "back", muscleGroupZh: "背部", mode: "bodyweight", sets: 3, reps: "8-12", restSeconds: 60, descriptionZh: "身体保持直线，肘部向后拉，胸部靠近横杆。" },
    { id: "lat_pulldown", name: "Lat Pulldown", nameZh: "高位下拉", muscleGroup: "back", muscleGroupZh: "背部", mode: "gym", sets: 4, reps: "8-12", restSeconds: 90, descriptionZh: "先沉肩，再将横杆拉向上胸，避免身体大幅后仰。" }
  ],
  shoulder: [
    { id: "pike_push_up", name: "Pike Push-Up", nameZh: "派克俯卧撑", muscleGroup: "shoulder", muscleGroupZh: "肩部", mode: "bodyweight", sets: 3, reps: "6-10", restSeconds: 60, descriptionZh: "臀部抬高形成倒 V 字，头顶方向缓慢下放并推起。" },
    { id: "db_press", name: "Dumbbell Shoulder Press", nameZh: "哑铃肩推", muscleGroup: "shoulder", muscleGroupZh: "肩部", mode: "gym", sets: 3, reps: "8-10", restSeconds: 90, descriptionZh: "收紧核心，哑铃沿耳侧推起，避免腰部过度后弯。" }
  ],
  biceps: [
    { id: "band_curl", name: "Band Curl", nameZh: "弹力带弯举", muscleGroup: "biceps", muscleGroupZh: "肱二头肌", mode: "bodyweight", sets: 3, reps: "12-15", restSeconds: 45, descriptionZh: "保持上臂稳定，专注屈肘，避免借力摆动。" },
    { id: "db_curl", name: "Dumbbell Curl", nameZh: "哑铃弯举", muscleGroup: "biceps", muscleGroupZh: "肱二头肌", mode: "gym", sets: 3, reps: "10-12", restSeconds: 60, descriptionZh: "肘部贴近身体，慢速下放，避免腰背代偿。" }
  ],
  triceps: [
    { id: "close_push_up", name: "Close-Grip Push-Up", nameZh: "窄距俯卧撑", muscleGroup: "triceps", muscleGroupZh: "肱三头肌", mode: "bodyweight", sets: 3, reps: "8-12", restSeconds: 60, descriptionZh: "双手略窄于肩，保持肘部向后，重点感受手臂后侧。" },
    { id: "rope_pushdown", name: "Rope Pushdown", nameZh: "绳索下压", muscleGroup: "triceps", muscleGroupZh: "肱三头肌", mode: "gym", sets: 3, reps: "10-12", restSeconds: 60, descriptionZh: "上臂固定，肘部完全伸直时稍微向外分开绳头。" }
  ],
  quads: [
    { id: "bodyweight_squat", name: "Bodyweight Squat", nameZh: "自重深蹲", muscleGroup: "quads", muscleGroupZh: "股四头肌", mode: "bodyweight", sets: 4, reps: "12-20", restSeconds: 60, descriptionZh: "髋膝同步屈曲，膝盖跟随脚尖方向，站起时脚掌均匀发力。" },
    { id: "barbell_squat", name: "Barbell Squat", nameZh: "杠铃深蹲", muscleGroup: "quads", muscleGroupZh: "股四头肌", mode: "gym", sets: 4, reps: "5-8", restSeconds: 120, descriptionZh: "核心绷紧，髋部向后向下坐，保证脊柱中立后站起。" }
  ],
  hamstrings: [
    { id: "single_leg_rdl", name: "Single-Leg Romanian Deadlift", nameZh: "单腿罗马尼亚硬拉", muscleGroup: "hamstrings", muscleGroupZh: "腘绳肌", mode: "bodyweight", sets: 3, reps: "10-12", restSeconds: 60, descriptionZh: "髋部后移，保持背部平直，用支撑腿后侧控制动作。" },
    { id: "rdl", name: "Romanian Deadlift", nameZh: "罗马尼亚硬拉", muscleGroup: "hamstrings", muscleGroupZh: "腘绳肌", mode: "gym", sets: 4, reps: "6-10", restSeconds: 120, descriptionZh: "臀部后移，杠铃贴腿下放，感受大腿后侧拉伸后髋伸站起。" }
  ],
  glutes: [
    { id: "glute_bridge", name: "Glute Bridge", nameZh: "臀桥", muscleGroup: "glutes", muscleGroupZh: "臀部", mode: "bodyweight", sets: 3, reps: "12-20", restSeconds: 45, descriptionZh: "脚跟踩稳，骨盆后倾后顶髋，在顶点收紧臀部。" },
    { id: "hip_thrust", name: "Hip Thrust", nameZh: "杠铃臀推", muscleGroup: "glutes", muscleGroupZh: "臀部", mode: "gym", sets: 4, reps: "8-12", restSeconds: 90, descriptionZh: "上背靠凳，顶髋至躯干平行地面，避免腰椎代偿。" }
  ],
  calves: [
    { id: "calf_raise", name: "Standing Calf Raise", nameZh: "站姿提踵", muscleGroup: "calves", muscleGroupZh: "小腿", mode: "both", sets: 3, reps: "12-20", restSeconds: 45, descriptionZh: "全程控制脚踝上下活动，顶点停顿，避免借力弹动。" }
  ],
  core: [
    { id: "plank", name: "Plank", nameZh: "平板支撑", muscleGroup: "core", muscleGroupZh: "核心", mode: "both", sets: 3, reps: "30-45 sec", restSeconds: 45, descriptionZh: "肩、髋、踝保持直线，收紧腹部和臀部，避免塌腰。" },
    { id: "dead_bug", name: "Dead Bug", nameZh: "死虫式", muscleGroup: "core", muscleGroupZh: "核心", mode: "both", sets: 3, reps: "10-12 / side", restSeconds: 45, descriptionZh: "腰背贴近地面，对侧手脚缓慢伸展，保持核心稳定。" }
  ]
};

const cardioLibrary = {
  lowImpact: {
    bodyweight: { id: "brisk_walk", name: "Brisk Walk", nameZh: "快走", mode: "bodyweight", durationMinutes: 35, intensity: "低到中等", descriptionZh: "保持能说完整句子但略微喘的速度，优先稳定完成。" },
    gym: { id: "incline_walk", name: "Incline Treadmill Walk", nameZh: "跑步机坡走", mode: "gym", durationMinutes: 30, intensity: "低到中等", descriptionZh: "选择可持续的坡度和速度，以心肺负担可控为优先。" }
  },
  intervals: {
    bodyweight: { id: "walk_jog_intervals", name: "Walk-Jog Intervals", nameZh: "走跑间歇", mode: "bodyweight", durationMinutes: 20, intensity: "中等到较高", descriptionZh: "快走与慢跑交替，先保证动作和心率恢复，再逐步加快。" },
    gym: { id: "bike_intervals", name: "Stationary Bike Intervals", nameZh: "动感单车间歇", mode: "gym", durationMinutes: 20, intensity: "中等到较高", descriptionZh: "短时加速与轻松骑行交替，对关节冲击相对较小。" }
  }
};

export function pickExercises(groups, mode) {
  return groups.flatMap((group) =>
    (library[group] || []).filter((exercise) => exercise.mode === mode || exercise.mode === "both").slice(0, 1)
  );
}

export function pickCardio(type, mode) {
  return cardioLibrary[type][mode];
}
