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
    if(target.resourceType) {
        // 掉落的资源
        if(this.pickup(target) === ERR_NOT_IN_RANGE) {
            this.moveTo(target, {visualizePathStyle: {stroke: '#ffaa00'}});
        }
        return true;
    } else if(target.store) {
        // 有存储的对象（结构、墓碑、废墟等）
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
    // 检查是否处于紧急状态
    const isEmergency = this.memory.emergency || 
                       (this.room.memory.emergencyFlags && this.room.memory.emergencyFlags.prioritizeHarvesting);
    
    // 如果已经有分配的能量源且还有能量，继续使用
    if(this.memory.sourceId) {
        const currentSource = Game.getObjectById(this.memory.sourceId);
        if(currentSource && currentSource.energy > 0) {
            // 检查是否有太多creep在同一个源
            const creepsAtSource = _.filter(Game.creeps, c => 
                c.memory.sourceId === this.memory.sourceId && 
                c.pos.getRangeTo(currentSource) <= 2
            ).length;
            
            // 计算源周围的可用位置
            const terrain = this.room.getTerrain();
            let availablePositions = 0;
            
            for(let dx = -1; dx <= 1; dx++) {
                for(let dy = -1; dy <= 1; dy++) {
                    if(dx === 0 && dy === 0) continue; // 跳过源本身的位置
                    
                    const x = currentSource.pos.x + dx;
                    const y = currentSource.pos.y + dy;
                    
                    // 检查位置是否在房间内且不是墙
                    if(x >= 0 && x < 50 && y >= 0 && y < 50 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                        availablePositions++;
                    }
                }
            }
            
            // 即使在紧急情况下，也不要超过可用位置的1.5倍
            const maxCreepsPerSource = Math.min(availablePositions * 1.5, availablePositions + 2);
            
            // 如果creep数量没有超过最大限制，继续使用当前源
            if(creepsAtSource <= maxCreepsPerSource) {
                return currentSource;
            } else {
                // 如果当前源过于拥挤，记录日志并尝试寻找新源
                console.log(`Creep ${this.name} 放弃拥挤的源 ${currentSource.id} (${creepsAtSource}/${maxCreepsPerSource})`);
            }
        }
    }
    
    // 寻找新的能量源
    const sources = this.room.find(FIND_SOURCES_ACTIVE);
    if(sources.length === 0) return null;
    
    // 计算每个能量源的使用情况和可用位置
    const sourceData = {};
    sources.forEach(source => {
        const creepsAtSource = _.filter(Game.creeps, c => 
            c.memory.sourceId === source.id && 
            c.pos.getRangeTo(source) <= 2
        ).length;
        
        // 计算源周围的可用位置
        const terrain = this.room.getTerrain();
        let availablePositions = 0;
        
        for(let dx = -1; dx <= 1; dx++) {
            for(let dy = -1; dy <= 1; dy++) {
                if(dx === 0 && dy === 0) continue; // 跳过源本身的位置
                
                const x = source.pos.x + dx;
                const y = source.pos.y + dy;
                
                // 检查位置是否在房间内且不是墙
                if(x >= 0 && x < 50 && y >= 0 && y < 50 && terrain.get(x, y) !== TERRAIN_MASK_WALL) {
                    availablePositions++;
                }
            }
        }
        
        // 即使在紧急情况下，也不要超过可用位置的1.5倍
        const maxCreepsPerSource = Math.min(availablePositions * 1.5, availablePositions + 2);
        
        // 如果源已满，跳过（除非所有源都满了）
        if(creepsAtSource >= maxCreepsPerSource && !isEmergency) {
            return;
        }
        
        sourceData[source.id] = {
            source: source,
            creepsCount: creepsAtSource,
            availablePositions: availablePositions,
            maxCreeps: maxCreepsPerSource,
            // 计算拥挤度分数（越低越好）
            crowdScore: creepsAtSource / Math.max(1, availablePositions),
            // 计算距离分数
            distanceScore: this.pos.getRangeTo(source) / 50
        };
    });
    
    // 选择最佳源
    let bestSource = null;
    let bestScore = Infinity;
    
    for(let id in sourceData) {
        const data = sourceData[id];
        // 如果源已满且不是紧急情况，跳过
        if(data.creepsCount >= data.maxCreeps && !isEmergency) continue;
        
        // 计算综合分数 - 在紧急情况下更重视距离
        const score = isEmergency ? 
            data.distanceScore * 0.7 + data.crowdScore * 0.3 : 
            data.crowdScore * 0.7 + data.distanceScore * 0.3;
        
        if(score < bestScore) {
            bestScore = score;
            bestSource = data.source;
        }
    }
    
    // 如果所有源都满了，选择最近的源
    if(!bestSource && sources.length > 0) {
        bestSource = this.pos.findClosestByPath(sources);
        console.log(`Creep ${this.name} 所有源都已满，选择最近的源 ${bestSource.id}`);
    }
    
    // 更新内存
    if(bestSource) {
        this.memory.sourceId = bestSource.id;
        
        // 记录源分配情况
        if(Game.time % 100 === 0) {
            const creepsAtSource = _.filter(Game.creeps, c => c.memory.sourceId === bestSource.id).length;
            console.log(`Creep ${this.name} 分配到源 ${bestSource.id} (${creepsAtSource} creeps)`);
        }
    }
    
    return bestSource;
};

// 新增：从最佳能量源采集能量
Creep.prototype.harvestOptimalSource = function() {
    const source = this.getOptimalSource();
    
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