export type Muscle =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
  | 'Biceps'
  | 'Triceps'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Abs';

export const MUSCLES: Muscle[] = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Abs',
];

export type Equipment = 'Barbell' | 'Dumbbell' | 'Machine' | 'Cable' | 'Bodyweight' | 'Other';
export const EQUIPMENT: Equipment[] = ['Barbell', 'Dumbbell', 'Machine', 'Cable', 'Bodyweight', 'Other'];

export type Category = 'Push' | 'Pull' | 'Legs' | 'Core' | 'Cardio';
export type Difficulty = 'Beginner' | 'Intermediate' | 'Advanced';

/**
 * How sets are recorded:
 *  weighted   - weight x reps
 *  bodyweight - reps (optional added weight)
 *  assisted   - assistance weight x reps (less assistance = stronger)
 *  timed      - duration in seconds
 *  cardio     - duration in minutes
 */
export type TrackingType = 'weighted' | 'bodyweight' | 'assisted' | 'timed' | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  /** Primary muscle group (used for rankings). */
  muscle: Muscle;
  secondary: Muscle[];
  equipment: Equipment;
  category: Category;
  difficulty: Difficulty;
  tracking: TrackingType;
  instructions: string;
  /** Has strength standards, so it counts toward ranks. */
  ranked: boolean;
}

type Row = [
  id: string, name: string, muscle: Muscle, secondary: Muscle[], equipment: Equipment, category: Category,
  difficulty: Difficulty, tracking: TrackingType, instructions: string, ranked?: boolean,
];

const rows: Row[] = [
  // ---- Chest
  ['bench-press', 'Bench Press', 'Chest', ['Triceps', 'Shoulders'], 'Barbell', 'Push', 'Intermediate', 'weighted',
    'Lie on a flat bench with feet planted. Lower the bar to mid-chest under control, then press it back up until your arms are straight.', true],
  ['incline-bench', 'Incline Bench Press', 'Chest', ['Shoulders', 'Triceps'], 'Barbell', 'Push', 'Intermediate', 'weighted',
    'Set the bench to a 30 to 45 degree angle. Lower the bar to your upper chest and press up without letting your shoulders roll forward.', true],
  ['db-bench', 'Dumbbell Bench Press', 'Chest', ['Triceps', 'Shoulders'], 'Dumbbell', 'Push', 'Beginner', 'weighted',
    'Lie on a flat bench holding dumbbells at chest level. Press them up and slightly together, then lower until you feel a stretch in your chest.'],
  ['incline-db-press', 'Incline Dumbbell Press', 'Chest', ['Shoulders', 'Triceps'], 'Dumbbell', 'Push', 'Beginner', 'weighted',
    'On an incline bench, press the dumbbells from shoulder height to full extension, then lower them slowly to the sides of your upper chest.'],
  ['chest-fly', 'Chest Fly', 'Chest', ['Shoulders'], 'Dumbbell', 'Push', 'Beginner', 'weighted',
    'Lie on a bench with dumbbells above your chest and a slight bend in your elbows. Open your arms wide in an arc, then squeeze them back together.'],
  ['cable-fly', 'Cable Fly', 'Chest', ['Shoulders'], 'Cable', 'Push', 'Beginner', 'weighted',
    'Stand between two cable stacks with the handles at shoulder height. Step forward and bring your hands together in front of your chest in a wide hugging motion.'],
  ['pec-deck', 'Pec Deck', 'Chest', ['Shoulders'], 'Machine', 'Push', 'Beginner', 'weighted',
    'Sit with your back flat against the pad and your forearms on the arm pads. Bring the pads together in front of you, pause, and return slowly.'],
  ['push-up', 'Push-up', 'Chest', ['Triceps', 'Shoulders', 'Abs'], 'Bodyweight', 'Push', 'Beginner', 'bodyweight',
    'Start in a plank with hands under your shoulders. Lower your chest to just above the floor with a straight body, then push back up.'],
  // ---- Back
  ['deadlift', 'Deadlift', 'Back', ['Hamstrings', 'Glutes'], 'Barbell', 'Pull', 'Advanced', 'weighted',
    'Stand with the bar over mid-foot. Hinge at the hips, grip the bar, brace your core and stand up by driving through your legs while keeping the bar close to you.', true],
  ['barbell-row', 'Barbell Row', 'Back', ['Biceps', 'Shoulders'], 'Barbell', 'Pull', 'Intermediate', 'weighted',
    'Hinge forward with a flat back holding the bar. Pull it to your lower ribs, squeeze your shoulder blades together, then lower under control.', true],
  ['db-row', 'Dumbbell Row', 'Back', ['Biceps'], 'Dumbbell', 'Pull', 'Beginner', 'weighted',
    'Support one hand and knee on a bench. Pull the dumbbell to your hip keeping your elbow close to your body, then lower it fully.'],
  ['pull-up', 'Pull-up', 'Back', ['Biceps'], 'Bodyweight', 'Pull', 'Intermediate', 'bodyweight',
    'Hang from a bar with an overhand grip. Pull your chest toward the bar by driving your elbows down, then lower to a full hang.'],
  ['assisted-pull-up', 'Assisted Pull-up', 'Back', ['Biceps'], 'Machine', 'Pull', 'Beginner', 'assisted',
    'Kneel on the assist pad and grip the bars. Pull yourself up until your chin passes the bar. Log the assistance weight; less assistance means more strength.'],
  ['lat-pulldown', 'Lat Pulldown', 'Back', ['Biceps'], 'Cable', 'Pull', 'Beginner', 'weighted',
    'Sit with thighs secured under the pad. Pull the bar to your upper chest by driving your elbows down and back, then let it rise slowly.', true],
  ['seated-row', 'Seated Cable Row', 'Back', ['Biceps'], 'Cable', 'Pull', 'Beginner', 'weighted',
    'Sit tall with a slight knee bend. Pull the handle to your stomach, squeeze your shoulder blades together, and return with control.'],
  ['t-bar-row', 'T-Bar Row', 'Back', ['Biceps', 'Shoulders'], 'Barbell', 'Pull', 'Intermediate', 'weighted',
    'Straddle the bar and hinge forward with a flat back. Pull the handle toward your chest, pause, and lower slowly.'],
  ['straight-arm-pulldown', 'Straight Arm Pulldown', 'Back', ['Triceps'], 'Cable', 'Pull', 'Beginner', 'weighted',
    'Stand facing a high cable with straight arms. Sweep the bar down to your thighs using your lats, then return slowly.'],
  // ---- Shoulders
  ['overhead-press', 'Shoulder Press', 'Shoulders', ['Triceps'], 'Barbell', 'Push', 'Intermediate', 'weighted',
    'Stand with the bar at shoulder height. Brace your core and press it overhead until your arms lock out, then lower it back to your shoulders.', true],
  ['db-shoulder-press', 'Dumbbell Shoulder Press', 'Shoulders', ['Triceps'], 'Dumbbell', 'Push', 'Beginner', 'weighted',
    'Sit or stand holding dumbbells at shoulder height. Press them overhead until your arms are straight, then lower with control.'],
  ['lateral-raise', 'Lateral Raise', 'Shoulders', [], 'Dumbbell', 'Push', 'Beginner', 'weighted',
    'Stand with dumbbells at your sides. Raise your arms out to shoulder height with a slight elbow bend, then lower slowly.'],
  ['front-raise', 'Front Raise', 'Shoulders', ['Chest'], 'Dumbbell', 'Push', 'Beginner', 'weighted',
    'Hold dumbbells in front of your thighs. Raise them straight ahead to shoulder height without swinging, then lower slowly.'],
  ['rear-delt-fly', 'Rear Delt Fly', 'Shoulders', ['Back'], 'Dumbbell', 'Pull', 'Beginner', 'weighted',
    'Hinge forward holding dumbbells below your chest. Raise your arms out to the sides, squeezing your rear shoulders, then lower slowly.'],
  ['face-pull', 'Face Pull', 'Shoulders', ['Back'], 'Cable', 'Pull', 'Beginner', 'weighted',
    'Set a rope at face height. Pull it toward your face while flaring your elbows out, then extend your arms back slowly.'],
  ['upright-row', 'Upright Row', 'Shoulders', ['Biceps'], 'Barbell', 'Pull', 'Intermediate', 'weighted',
    'Hold the bar in front of your thighs. Pull it up toward your chest leading with your elbows, then lower it slowly.'],
  // ---- Biceps
  ['barbell-curl', 'Barbell Curl', 'Biceps', [], 'Barbell', 'Pull', 'Beginner', 'weighted',
    'Stand holding the bar with an underhand grip. Curl it to shoulder height keeping your elbows still, then lower slowly.', true],
  ['db-curl', 'Dumbbell Curl', 'Biceps', [], 'Dumbbell', 'Pull', 'Beginner', 'weighted',
    'Hold dumbbells at your sides with palms forward. Curl them up, squeeze at the top, and lower under control.'],
  ['hammer-curl', 'Hammer Curl', 'Biceps', [], 'Dumbbell', 'Pull', 'Beginner', 'weighted',
    'Hold dumbbells with palms facing each other. Curl them up without rotating your wrists, then lower slowly.'],
  ['preacher-curl', 'Preacher Curl', 'Biceps', [], 'Barbell', 'Pull', 'Beginner', 'weighted',
    'Rest your upper arms on the preacher pad. Curl the bar up and lower it until your arms are almost straight.'],
  ['cable-curl', 'Cable Curl', 'Biceps', [], 'Cable', 'Pull', 'Beginner', 'weighted',
    'Stand facing a low cable with a straight bar. Curl it up keeping your elbows at your sides, then lower slowly.'],
  ['concentration-curl', 'Concentration Curl', 'Biceps', [], 'Dumbbell', 'Pull', 'Beginner', 'weighted',
    'Sit with your elbow braced against your inner thigh. Curl the dumbbell up slowly, squeeze, and lower with control.'],
  // ---- Triceps
  ['tricep-pushdown', 'Triceps Pushdown', 'Triceps', [], 'Cable', 'Push', 'Beginner', 'weighted',
    'Stand at a high cable with elbows pinned to your sides. Push the bar down until your arms are straight, then let it rise slowly.'],
  ['overhead-extension', 'Overhead Extension', 'Triceps', [], 'Dumbbell', 'Push', 'Beginner', 'weighted',
    'Hold one dumbbell overhead with both hands. Lower it behind your head by bending your elbows, then extend back up.'],
  ['skull-crusher', 'Skull Crushers', 'Triceps', [], 'Barbell', 'Push', 'Intermediate', 'weighted',
    'Lie on a bench holding the bar above your chest. Bend your elbows to lower it toward your forehead, then extend back up.'],
  ['close-grip-bench', 'Close-Grip Bench Press', 'Triceps', ['Chest', 'Shoulders'], 'Barbell', 'Push', 'Intermediate', 'weighted',
    'Bench press with your hands about shoulder-width apart and elbows tucked. Lower to your lower chest and press up.', true],
  ['dips', 'Dips', 'Triceps', ['Chest', 'Shoulders'], 'Bodyweight', 'Push', 'Intermediate', 'bodyweight',
    'Support yourself on parallel bars. Lower until your upper arms are about parallel to the floor, then press back up to straight arms.'],
  // ---- Quads
  ['squat', 'Squat', 'Quads', ['Glutes', 'Hamstrings'], 'Barbell', 'Legs', 'Intermediate', 'weighted',
    'Set the bar on your upper back and brace your core. Sit down and back until your thighs are at least parallel, then drive up through your whole foot.', true],
  ['front-squat', 'Front Squat', 'Quads', ['Glutes', 'Abs'], 'Barbell', 'Legs', 'Advanced', 'weighted',
    'Rest the bar on your front shoulders with elbows high. Squat down keeping your torso upright, then stand back up.', true],
  ['leg-press', 'Leg Press', 'Quads', ['Glutes', 'Hamstrings'], 'Machine', 'Legs', 'Beginner', 'weighted',
    'Sit with your feet shoulder-width on the platform. Lower the sled until your knees reach about 90 degrees, then press without locking out hard.', true],
  ['leg-extension', 'Leg Extension', 'Quads', [], 'Machine', 'Legs', 'Beginner', 'weighted',
    'Sit with the pad on your lower shins. Extend your legs until they are straight, squeeze your quads, and lower slowly.'],
  ['lunge', 'Lunges', 'Quads', ['Glutes', 'Hamstrings'], 'Dumbbell', 'Legs', 'Beginner', 'weighted',
    'Step forward into a lunge until both knees are bent about 90 degrees, then push back to the start. Alternate legs.'],
  ['bulgarian-split-squat', 'Bulgarian Split Squat', 'Quads', ['Glutes'], 'Dumbbell', 'Legs', 'Intermediate', 'weighted',
    'Place your rear foot on a bench behind you. Lower straight down until your front thigh is parallel, then drive back up.'],
  // ---- Hamstrings
  ['rdl', 'Romanian Deadlift', 'Hamstrings', ['Glutes', 'Back'], 'Barbell', 'Legs', 'Intermediate', 'weighted',
    'Hold the bar at hip height. Push your hips back with a slight knee bend, lowering the bar along your legs until you feel a hamstring stretch, then stand up.', true],
  ['leg-curl', 'Leg Curl', 'Hamstrings', [], 'Machine', 'Legs', 'Beginner', 'weighted',
    'Lie or sit with the pad against your lower calves. Curl your heels toward your glutes, squeeze, and return slowly.'],
  // ---- Glutes
  ['hip-thrust', 'Hip Thrust', 'Glutes', ['Hamstrings'], 'Barbell', 'Legs', 'Intermediate', 'weighted',
    'Sit with your upper back against a bench and the bar over your hips. Drive your hips up until your body is straight from shoulders to knees, squeeze, and lower.', true],
  // ---- Calves
  ['calf-raise', 'Calf Raises', 'Calves', [], 'Machine', 'Legs', 'Beginner', 'weighted',
    'Stand with the balls of your feet on a platform. Rise as high as you can onto your toes, pause, then lower to a full stretch.', true],
  // ---- Abs
  ['crunch', 'Crunches', 'Abs', [], 'Bodyweight', 'Core', 'Beginner', 'bodyweight',
    'Lie on your back with knees bent. Curl your shoulders off the floor by contracting your abs, then lower slowly.'],
  ['cable-crunch', 'Cable Crunches', 'Abs', [], 'Cable', 'Core', 'Beginner', 'weighted',
    'Kneel below a high cable holding the rope by your head. Curl your torso down toward your knees using your abs, then return slowly.', true],
  ['hanging-leg-raise', 'Hanging Leg Raises', 'Abs', [], 'Bodyweight', 'Core', 'Intermediate', 'bodyweight',
    'Hang from a bar. Raise your legs until they are at least parallel to the floor without swinging, then lower under control.'],
  ['plank', 'Planks', 'Abs', ['Shoulders'], 'Bodyweight', 'Core', 'Beginner', 'timed',
    'Hold a straight line from head to heels on your forearms and toes, with your core braced and hips level. Log the time held.'],
  ['ab-wheel', 'Ab Wheel', 'Abs', ['Shoulders'], 'Other', 'Core', 'Advanced', 'bodyweight',
    'Kneel holding the wheel. Roll forward as far as you can with a flat back, then pull back to the start using your abs.'],
  // ---- Cardio
  ['treadmill', 'Treadmill', 'Quads', ['Calves', 'Hamstrings'], 'Machine', 'Cardio', 'Beginner', 'cardio',
    'Walk, jog or run on the treadmill. Log the time in minutes.'],
  ['cycling', 'Stationary Bike', 'Quads', ['Calves', 'Hamstrings'], 'Machine', 'Cardio', 'Beginner', 'cardio',
    'Cycle at a steady or interval pace. Log the time in minutes.'],
  ['rowing-machine', 'Rowing Machine', 'Back', ['Quads', 'Biceps'], 'Machine', 'Cardio', 'Beginner', 'cardio',
    'Drive with your legs first, then lean back and pull the handle to your ribs. Log the time in minutes.'],
];

export const EXERCISES: Exercise[] = rows.map(
  ([id, name, muscle, secondary, equipment, category, difficulty, tracking, instructions, ranked]) => ({
    id, name, muscle, secondary, equipment, category, difficulty, tracking, instructions, ranked: !!ranked,
  }),
);

export const exerciseById = (id: string): Exercise | undefined => EXERCISES.find((e) => e.id === id);

export const TRACKING_LABELS: Record<TrackingType, { a: string; b: string; showA: boolean }> = {
  weighted: { a: 'KG', b: 'REPS', showA: true },
  bodyweight: { a: '+KG', b: 'REPS', showA: true },
  assisted: { a: 'ASSIST KG', b: 'REPS', showA: true },
  timed: { a: '', b: 'SECONDS', showA: false },
  cardio: { a: '', b: 'MINUTES', showA: false },
};
