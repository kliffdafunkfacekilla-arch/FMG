import { describe, expect, it } from "vitest";
import { World } from "../../core/ecs/ecs";
import { NpcDataComponent, ScheduleComponent } from "./npc-components";
import { DailyScheduleSystem } from "./npc-system";

describe("NPC Schedule System", () => {
	it("should update NPC schedule based on delta time", () => {
		const world = new World();
		const system = new DailyScheduleSystem(world);

		const npc = world.createEntity();
		world.addComponent(npc, new NpcDataComponent("Bob", "Farmer"));
		world.addComponent(npc, new ScheduleComponent("sleeping", 8));

		// Time passes but not enough to change task
		system.update(4);
		let schedule = world.getComponent(npc, ScheduleComponent)!;
		expect(schedule.currentTask).toBe("sleeping");
		expect(schedule.taskTimer).toBe(4);

		// Time passes enough to change task
		system.update(4);
		schedule = world.getComponent(npc, ScheduleComponent)!;
		expect(schedule.currentTask).toBe("working");
		expect(schedule.taskTimer).toBe(8);

		system.update(8);
		schedule = world.getComponent(npc, ScheduleComponent)!;
		expect(schedule.currentTask).toBe("leisure");
		expect(schedule.taskTimer).toBe(4);

		system.update(4);
		schedule = world.getComponent(npc, ScheduleComponent)!;
		expect(schedule.currentTask).toBe("sleeping");
		expect(schedule.taskTimer).toBe(12);
	});
});
