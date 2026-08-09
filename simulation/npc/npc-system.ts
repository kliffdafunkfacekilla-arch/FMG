import { System } from "../../core/ecs/ecs";
import { ScheduleComponent, NpcDataComponent } from "./npc-components";

export class DailyScheduleSystem extends System {
    public update(deltaTime: number): void {
        const entities = this.world.queryEntities([ScheduleComponent, NpcDataComponent]);

        for (const entity of entities) {
            const schedule = this.world.getComponent(entity, ScheduleComponent)!;

            schedule.taskTimer -= deltaTime;

            if (schedule.taskTimer <= 0) {
                // simple cycle of tasks
                if (schedule.currentTask === "sleeping") {
                    schedule.currentTask = "working";
                    schedule.taskTimer += 8;
                } else if (schedule.currentTask === "working") {
                    schedule.currentTask = "leisure";
                    schedule.taskTimer += 4;
                } else {
                    schedule.currentTask = "sleeping";
                    schedule.taskTimer += 12;
                }
            }
        }
    }
}
