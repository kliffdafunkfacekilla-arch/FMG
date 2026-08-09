import { Component } from "../../core/ecs/ecs";

export class LocationComponent extends Component {
    public x: number;
    public y: number;
    public burgId: number;

    constructor(x: number, y: number, burgId: number) {
        super();
        this.x = x;
        this.y = y;
        this.burgId = burgId;
    }
}

export class ScheduleComponent extends Component {
    public currentTask: string;
    public taskTimer: number;

    constructor(currentTask: string, taskTimer: number) {
        super();
        this.currentTask = currentTask;
        this.taskTimer = taskTimer;
    }
}

export class NpcDataComponent extends Component {
    public name: string;
    public profession: string;

    constructor(name: string, profession: string) {
        super();
        this.name = name;
        this.profession = profession;
    }
}
