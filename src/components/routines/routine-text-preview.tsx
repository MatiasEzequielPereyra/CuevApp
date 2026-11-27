"use client";

import { ExerciseMention } from "@/components/routines/exercise-mention";
import { StudentWorkoutExerciseSummary } from "@/components/routines/student-workout-exercise-summary";
import type { RoutineMention } from "@/lib/routines/mentions";

export function RoutineTextPreview({ value, mentions, studentId }: {
  value: string;
  mentions: RoutineMention[];
  studentId: string;
}) {
  const points = Array.from(value);
  const ordered = [...mentions].sort((a,b)=>a.start-b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const [index, mention] of ordered.entries()) {
    if (mention.start < cursor || mention.start < 0 || mention.end > points.length
      || points.slice(mention.start, mention.end).join("") !== mention.text) continue;
    if (mention.start > cursor) parts.push(points.slice(cursor,mention.start).join(""));
    parts.push(
      <span className="routine-text-preview-mention" key={`${mention.exercise_id}-${mention.start}-${index}`}>
        <ExerciseMention exerciseId={mention.exercise_id} name={mention.text} description={null}
          videoAvailability="unknown" text={mention.text} publicationId="" trackingMode="weight"
          studentId={studentId} />
        <StudentWorkoutExerciseSummary exerciseId={mention.exercise_id} exerciseName={mention.text} studentId={studentId} />
      </span>
    );
    cursor=mention.end;
  }
  if(cursor<points.length) parts.push(points.slice(cursor).join(""));
  return <div className="routine-text-preview" style={{ whiteSpace: "pre-wrap" }}>{parts}</div>;
}
