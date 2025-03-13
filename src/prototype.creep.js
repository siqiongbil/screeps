const utils = require('utils');

// 为Creep添加一些有用的方法
Creep.prototype.harvestEnergy = function() {
    // 先尝试从容器获取能量
    if(this.withdrawFromContainer()) {
        return true;
    }
    
    // 如果没有可用的容器，再从能量源采集
    const source = this.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    if(source) {
        if(this.harvest(source) == ERR_NOT_IN_RANGE) {
            this.moveTo(source, {
                visualizePathStyle: {stroke: '#ffaa00'},
                reusePath: 5
            });
        }
        return true;
    }
    return false;
};

// 新增：从容器中获取能量
Creep.prototype.withdrawFromContainer = function() {
    const container = this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType == STRUCTURE_CONTAINER ||
                    structure.structureType == STRUCTURE_STORAGE) &&
                    structure.store[RESOURCE_ENERGY] > 50;  // 确保容器中有足够的能量
        }
    });
    
    if(container) {
        if(this.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            this.moveTo(container, {
                visualizePathStyle: {stroke: '#ffaa00'},
                reusePath: 5
            });
        }
        return true;
    }
    return false;
};

// 新增：通用资源收集方法
Creep.prototype.collectResource = function(target) {
    if(!target) return false;
    
    // 根据目标类型执行不同的收集逻辑
    if(target instanceof Resource) {
        if(this.pickup(target) === ERR_NOT_IN_RANGE) {
            this.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        return true;
    } else if(target instanceof Structure || target instanceof Tombstone || target instanceof Ruin) {
        const resourceType = Object.keys(target.store).find(type => target.store[type] > 0);
        if(resourceType) {
            if(this.withdraw(target, resourceType) === ERR_NOT_IN_RANGE) {
                this.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
            }
            return true;
        }
    }
    return false;
};

// 新增：转移能量到建筑
Creep.prototype.transferEnergy = function() {
    const target = this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => {
            return (structure.structureType == STRUCTURE_EXTENSION ||
                    structure.structureType == STRUCTURE_SPAWN ||
                    structure.structureType == STRUCTURE_TOWER) &&
                    structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
        }
    });
    
    if(target) {
        if(this.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
            this.moveTo(target, {
                visualizePathStyle: {stroke: '#ffffff'},
                reusePath: 5
            });
        }
        return true;
    }
    return false;
};

// 新增：智能工作状态切换
Creep.prototype.updateWorkingState = function() {
    if(this.memory.working && this.store[RESOURCE_ENERGY] == 0) {
        this.memory.working = false;
    }
    if(!this.memory.working && this.store.getFreeCapacity() == 0) {
        this.memory.working = true;
    }
    return this.memory.working;
};

// 新增：寻找最近的建筑工地
Creep.prototype.findConstructionSite = function() {
    return this.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
};

// 新增：寻找需要维修的建筑
Creep.prototype.findRepairTarget = function() {
    return this.pos.findClosestByPath(FIND_STRUCTURES, {
        filter: (structure) => {
            return structure.hits < structure.hitsMax &&
                   structure.hits < 10000; // 只修理血量低于10000的建筑
        }
    });
};

// 新增：智能建造
Creep.prototype.buildStructure = function(target) {
    if(!target) {
        target = this.findConstructionSite();
        if(!target) return false;
    }
    
    if(this.build(target) == ERR_NOT_IN_RANGE) {
        this.moveTo(target, {
            visualizePathStyle: {stroke: '#ffffff'},
            reusePath: 5
        });
    }
    return true;
};

// 新增：智能维修
Creep.prototype.repairStructure = function(target) {
    if(!target) {
        target = this.findRepairTarget();
        if(!target) return false;
    }
    
    if(this.repair(target) == ERR_NOT_IN_RANGE) {
        this.moveTo(target, {
            visualizePathStyle: {stroke: '#ffff00'},
            reusePath: 5
        });
    }
    return true;
};

// 新增：获取最佳能量源
Creep.prototype.getOptimalSource = function() {
    // 如果已经有分配的能量源且还有能量，继续使用
    if(this.memory.sourceId) {
        const currentSource = Game.getObjectById(this.memory.sourceId);
        if(currentSource && currentSource.energy > 0) {
            return currentSource;
        }
    }
    
    // 寻找新的能量源
    const sources = this.room.find(FIND_SOURCES_ACTIVE);
    if(sources.length === 0) return null;
    
    // 计算每个能量源的使用情况
    const sourceUsage = {};
    sources.forEach(source => {
        sourceUsage[source.id] = _.filter(Game.creeps, c => 
            c.memory.sourceId === source.id
        ).length;
    });
    
    // 选择使用人数最少的能量源
    const leastUsedSource = sources.reduce((a, b) => 
        sourceUsage[a.id] <= sourceUsage[b.id] ? a : b
    );
    
    // 更新内存
    this.memory.sourceId = leastUsedSource.id;
    return leastUsedSource;
};

// 新增：智能采集能量
Creep.prototype.harvestOptimalSource = function() {
    const source = this.getOptimalSource();
    if(!source) return false;
    
    if(this.harvest(source) == ERR_NOT_IN_RANGE) {
        this.moveTo(source, {
            visualizePathStyle: {stroke: '#ffaa00'},
            reusePath: 5
        });
    }
    return true;
}; 