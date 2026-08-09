import { describe, it, expect } from "vitest";
import { World, Component, System } from "./ecs";

class TestComponent extends Component {
    public value: number;
    constructor(value: number) {
        super();
        this.value = value;
    }
}

class TestSystem extends System {
    public update(deltaTime: number): void {
        const entities = this.world.queryEntities([TestComponent]);
        for (const entity of entities) {
            const comp = this.world.getComponent(entity, TestComponent)!;
            comp.value += deltaTime;
        }
    }
}

describe("ECS Core", () => {
    it("should create entities and manage components", () => {
        const world = new World();
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        world.addComponent(entity1, new TestComponent(10));
        world.addComponent(entity2, new TestComponent(20));

        const comp1 = world.getComponent(entity1, TestComponent);
        expect(comp1).toBeDefined();
        expect(comp1!.value).toBe(10);

        world.removeComponent(entity1, TestComponent);
        expect(world.getComponent(entity1, TestComponent)).toBeUndefined();
    });

    it("should process systems correctly", () => {
        const world = new World();
        const system = new TestSystem(world);

        const entity = world.createEntity();
        world.addComponent(entity, new TestComponent(0));

        system.update(5);
        expect(world.getComponent(entity, TestComponent)!.value).toBe(5);
    });
});
