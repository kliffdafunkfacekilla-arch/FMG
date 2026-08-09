export type Entity = number;

export abstract class Component {
    // Base class for components
}

// Ensure component types can be instantiated or identified
export type ComponentClass<T extends Component> = new (...args: any[]) => T;

export class World {
    private entities: Set<Entity> = new Set();
    private components: Map<string, Map<Entity, Component>> = new Map();
    private nextEntityId: Entity = 1;

    public createEntity(): Entity {
        const entity = this.nextEntityId++;
        this.entities.add(entity);
        return entity;
    }

    public destroyEntity(entity: Entity): void {
        this.entities.delete(entity);
        for (const [, entityComponents] of this.components) {
            entityComponents.delete(entity);
        }
    }

    public addComponent<T extends Component>(entity: Entity, component: T): void {
        const componentName = component.constructor.name;
        if (!this.components.has(componentName)) {
            this.components.set(componentName, new Map());
        }
        this.components.get(componentName)!.set(entity, component);
    }

    public getComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): T | undefined {
        const componentName = componentClass.name;
        const entityComponents = this.components.get(componentName);
        if (entityComponents) {
            return entityComponents.get(entity) as T;
        }
        return undefined;
    }

    public removeComponent<T extends Component>(entity: Entity, componentClass: ComponentClass<T>): void {
        const componentName = componentClass.name;
        const entityComponents = this.components.get(componentName);
        if (entityComponents) {
            entityComponents.delete(entity);
        }
    }

    public queryEntities(componentClasses: ComponentClass<any>[]): Entity[] {
        const result: Entity[] = [];
        for (const entity of this.entities) {
            let hasAll = true;
            for (const componentClass of componentClasses) {
                const componentName = componentClass.name;
                if (!this.components.get(componentName)?.has(entity)) {
                    hasAll = false;
                    break;
                }
            }
            if (hasAll) {
                result.push(entity);
            }
        }
        return result;
    }
}

export abstract class System {
    protected world: World;

    constructor(world: World) {
        this.world = world;
    }

    public abstract update(deltaTime: number): void;
}
