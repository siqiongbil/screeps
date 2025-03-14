/**
 * 可视化模块
 * 提供各种可视化功能，帮助理解游戏状态
 */

// 导入需要的模块
const energyUtils = require('energyUtils');

module.exports = {
    // 主运行函数
    run: function(room) {
        // 每10个tick运行一次
        if(Game.time % 10 !== 0) return;
        
        try {
            // 创建可视化对象
            const visual = room.visual;
            
            // 显示房间状态
            this.showRoomStatus(room, visual);
            
            // 显示能源源
            this.showSources(room, visual);
            
            // 显示creep路径
            this.showCreepPaths(room, visual);
            
            // 显示建筑规划
            this.showBuildingPlan(room, visual);
            
            // 显示母巢状态
            this.showSpawnStatus(room, visual);
        } catch(error) {
            console.log(`可视化错误 ${room.name}: ${error}`);
        }
    },
    
    // 显示房间状态
    showRoomStatus: function(room, visual) {
        // 显示房间名称和控制器等级
        visual.text(`房间: ${room.name}`, 1, 1, {
            color: 'white',
            font: 0.8,
            align: 'left'
        });
        
        visual.text(`控制器: ${room.controller ? room.controller.level : '无'}`, 1, 2, {
            color: 'white',
            font: 0.8,
            align: 'left'
        });
        
        // 显示能源状态 - 仅考虑spawn/extension能量
        const energyStatus = energyUtils.getRoomStatus(room);
        visual.text(`能源: ${energyStatus.energy}/${energyStatus.energyCapacity} (${Math.round(energyStatus.energyLevel * 100)}%)`, 1, 3, {
            color: energyStatus.energyLevel > 0.5 ? 'green' : (energyStatus.energyLevel > 0.2 ? 'yellow' : 'red'),
            font: 0.8,
            align: 'left'
        });
        
        // 显示容器能量 - 仅供参考
        if(energyStatus.containers > 0) {
            visual.text(`容器: ${energyStatus.containerEnergy}/${energyStatus.containerCapacity}`, 1, 4, {
                color: 'grey',
                font: 0.7,
                align: 'left'
            });
        }
        
        // 显示creep数量
        const creepCount = _.filter(Game.creeps, c => c.room.name === room.name).length;
        visual.text(`Creeps: ${creepCount}`, 1, 5, {
            color: 'white',
            font: 0.8,
            align: 'left'
        });
        
        // 显示敌人数量
        const hostileCount = room.find(FIND_HOSTILE_CREEPS).length;
        visual.text(`敌人: ${hostileCount}`, 1, 6, {
            color: hostileCount > 0 ? 'red' : 'green',
            font: 0.8,
            align: 'left'
        });
        
        // 显示建筑工地数量
        const siteCount = room.find(FIND_CONSTRUCTION_SITES).length;
        visual.text(`建筑工地: ${siteCount}`, 1, 7, {
            color: 'white',
            font: 0.8,
            align: 'left'
        });
        
        // 显示观察者状态
        if(room.controller && room.controller.level >= 8) {
            const observer = room.find(FIND_MY_STRUCTURES, {
                filter: s => s.structureType === STRUCTURE_OBSERVER
            })[0];
            
            if(observer && room.memory.observerManager) {
                const observerManager = room.memory.observerManager;
                const lastRoom = observerManager.status.lastObservedRoom || '无';
                const autoMode = observerManager.status.autoObserveEnabled ? 
                    `自动(${this.getObserveModeName(observerManager.status.autoObserveMode)})` : '手动';
                
                visual.text(`观察者: ${lastRoom}`, 1, 8, {
                    color: 'cyan',
                    font: 0.8,
                    align: 'left'
                });
                
                visual.text(`模式: ${autoMode}`, 1, 9, {
                    color: 'cyan',
                    font: 0.8,
                    align: 'left'
                });
            }
        }
    },
    
    // 显示能源源
    showSources: function(room, visual) {
        const sources = room.find(FIND_SOURCES);
        
        sources.forEach(source => {
            // 绘制圆圈
            visual.circle(source.pos, {
                radius: 0.75,
                fill: source.energy > 0 ? 'yellow' : 'gray',
                opacity: 0.5
            });
            
            // 显示能源量
            visual.text(`${source.energy}/${source.energyCapacity}`, source.pos.x, source.pos.y - 1, {
                color: 'white',
                font: 0.5
            });
            
            // 如果有能源分配系统，显示采集者数量
            if(room.memory.energyDistributor && 
               room.memory.energyDistributor.collection.sources && 
               room.memory.energyDistributor.collection.sources[source.id]) {
                
                const sourceInfo = room.memory.energyDistributor.collection.sources[source.id];
                
                visual.text(`采集者: ${sourceInfo.harvesters || 0}`, source.pos.x, source.pos.y + 1, {
                    color: 'white',
                    font: 0.5
                });
            }
        });
    },
    
    // 显示creep路径
    showCreepPaths: function(room, visual) {
        const creeps = room.find(FIND_MY_CREEPS);
        
        creeps.forEach(creep => {
            // 如果creep有移动目标，显示路径
            if(creep.memory._move && creep.memory._move.dest) {
                const dest = creep.memory._move.dest;
                
                // 绘制路径线
                visual.line(creep.pos, new RoomPosition(dest.x, dest.y, dest.room), {
                    color: this.getRoleColor(creep.memory.role),
                    width: 0.1,
                    opacity: 0.3
                });
                
                // 在目标位置绘制点
                visual.circle(new RoomPosition(dest.x, dest.y, dest.room), {
                    radius: 0.2,
                    fill: this.getRoleColor(creep.memory.role)
                });
            }
            
            // 显示creep角色
            visual.text(creep.memory.role, creep.pos.x, creep.pos.y - 0.5, {
                color: this.getRoleColor(creep.memory.role),
                font: 0.4
            });
        });
    },
    
    // 显示建筑规划
    showBuildingPlan: function(room, visual) {
        // 显示建筑工地
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        
        sites.forEach(site => {
            // 使用rect绘制建筑工地
            visual.rect(site.pos.x - 0.5, site.pos.y - 0.5, 1, 1, {
                fill: this.getStructureColor(site.structureType),
                opacity: 0.3
            });
            
            // 显示进度
            visual.text(`${site.progress}/${site.progressTotal}`, site.pos.x, site.pos.y + 0.5, {
                color: 'white',
                font: 0.4
            });
        });
        
        // 如果有建筑规划，显示规划
        if(room.memory.buildingPlan && room.memory.buildingPlan.structures) {
            // 获取当前母巢数量
            const currentSpawns = room.find(FIND_MY_SPAWNS).length;
            let spawnCount = currentSpawns;
            
            for(const structureType in room.memory.buildingPlan.structures) {
                const positions = room.memory.buildingPlan.structures[structureType];
                
                positions.forEach(pos => {
                    // 检查位置是否已经有建筑或建筑工地
                    const structures = room.lookForAt(LOOK_STRUCTURES, pos.x, pos.y);
                    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, pos.x, pos.y);
                    
                    if(structures.length === 0 && sites.length === 0) {
                        // 使用rect绘制规划
                        visual.rect(pos.x - 0.5, pos.y - 0.5, 1, 1, {
                            fill: this.getStructureColor(structureType),
                            opacity: 0.2
                        });
                        
                        // 对于母巢，添加特殊标记
                        if(structureType === STRUCTURE_SPAWN) {
                            spawnCount++;
                            
                            visual.circle(pos.x, pos.y, {
                                radius: 0.6,
                                fill: '#ff00ff',
                                opacity: 0.4
                            });
                            
                            visual.text('🏠', pos.x, pos.y, {
                                font: 0.7,
                                align: 'center'
                            });
                            
                            // 显示母巢编号
                            visual.text(`母巢 #${spawnCount}`, pos.x, pos.y - 0.7, {
                                color: '#ff00ff',
                                font: 0.5,
                                align: 'center'
                            });
                        }
                    }
                });
            }
        }
    },
    
    // 根据角色获取颜色
    getRoleColor: function(role) {
        const colors = {
            harvester: 'yellow',
            miner: 'yellow',
            carrier: 'orange',
            upgrader: 'green',
            builder: 'blue',
            repairer: 'purple',
            defender: 'red',
            healer: 'white',
            rangedAttacker: 'pink',
            scout: 'gray'
        };
        
        return colors[role] || 'white';
    },
    
    // 根据建筑类型获取颜色
    getStructureColor: function(structureType) {
        const colors = {
            [STRUCTURE_SPAWN]: '#ff00ff',
            [STRUCTURE_EXTENSION]: '#ff99ff',
            [STRUCTURE_ROAD]: '#999999',
            [STRUCTURE_WALL]: '#666666',
            [STRUCTURE_RAMPART]: '#00ff00',
            [STRUCTURE_LINK]: '#0000ff',
            [STRUCTURE_STORAGE]: '#ffff00',
            [STRUCTURE_TOWER]: '#ff0000',
            [STRUCTURE_OBSERVER]: '#00ffff',
            [STRUCTURE_POWER_SPAWN]: '#ff9900',
            [STRUCTURE_EXTRACTOR]: '#00ff99',
            [STRUCTURE_LAB]: '#9900ff',
            [STRUCTURE_TERMINAL]: '#ff9999',
            [STRUCTURE_CONTAINER]: '#ffcc00',
            [STRUCTURE_NUKER]: '#ff0099',
            [STRUCTURE_FACTORY]: '#99ffcc',
            [STRUCTURE_KEEPER_LAIR]: '#ff0000',
            [STRUCTURE_CONTROLLER]: '#0099ff',
            [STRUCTURE_POWER_BANK]: '#ffcc99'
        };
        
        return colors[structureType] || '#ffffff';
    },
    
    // 添加获取观察模式名称的辅助函数
    getObserveModeName: function(mode) {
        const modeNames = {
            'scout': '侦察',
            'mineral': '矿物',
            'hostile': '敌对'
        };
        
        return modeNames[mode] || mode;
    },
    
    // 添加显示母巢状态的方法
    showSpawnStatus: function(room, visual) {
        // 获取房间中的所有母巢
        const spawns = room.find(FIND_MY_SPAWNS);
        
        if(spawns.length === 0) return;
        
        // 显示每个母巢的状态
        spawns.forEach(spawn => {
            // 显示母巢名称
            visual.text(spawn.name, spawn.pos.x, spawn.pos.y - 1.2, {
                color: 'white',
                font: 0.5,
                align: 'center'
            });
            
            // 显示能源状态
            const energyPercent = Math.round((spawn.store[RESOURCE_ENERGY] / spawn.store.getCapacity(RESOURCE_ENERGY)) * 100);
            const energyColor = energyPercent > 70 ? 'green' : (energyPercent > 30 ? 'yellow' : 'red');
            
            visual.text(`⚡ ${energyPercent}%`, spawn.pos.x, spawn.pos.y - 0.8, {
                color: energyColor,
                font: 0.4,
                align: 'center'
            });
            
            // 如果正在孵化，显示进度
            if(spawn.spawning) {
                const creep = Game.creeps[spawn.spawning.name];
                const role = creep ? creep.memory.role : '未知';
                const progress = Math.round((spawn.spawning.needTime - spawn.spawning.remainingTime) / spawn.spawning.needTime * 100);
                
                // 显示孵化进度条
                visual.rect(spawn.pos.x - 0.5, spawn.pos.y + 0.8, 1, 0.2, {
                    fill: '#555555',
                    opacity: 0.8
                });
                
                visual.rect(spawn.pos.x - 0.5, spawn.pos.y + 0.8, progress / 100, 0.2, {
                    fill: 'yellow',
                    opacity: 0.8
                });
                
                // 显示角色和进度
                visual.text(`🥚 ${role} (${progress}%)`, spawn.pos.x, spawn.pos.y + 0.5, {
                    color: 'yellow',
                    font: 0.4,
                    align: 'center'
                });
            }
        });
        
        // 显示孵化队列信息
        if(Memory.spawns && Memory.spawns.queues && Memory.spawns.queues[room.name]) {
            const queue = Memory.spawns.queues[room.name].queue;
            
            if(queue.length > 0) {
                // 显示队列长度
                visual.text(`孵化队列: ${queue.length}`, 1, 8, {
                    color: 'white',
                    font: 0.7,
                    align: 'left'
                });
                
                // 显示前3个请求
                for(let i = 0; i < Math.min(queue.length, 3); i++) {
                    const request = queue[i];
                    visual.text(`${i+1}. ${request.role}`, 1, 9 + i, {
                        color: i === 0 ? 'green' : 'white',
                        font: 0.6,
                        align: 'left'
                    });
                }
            }
        }
    }
}; 