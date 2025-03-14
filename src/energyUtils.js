/**
 * 能量工具模块
 * 提供与能量管理相关的工具函数
 */
module.exports = {
    // 能源阈值常量
    ENERGY_THRESHOLDS: {
        CRITICAL: 0.2,  // 低于20%为危急状态
        LOW: 0.4,       // 低于40%为低能源状态
        NORMAL: 0.6,    // 低于60%为正常状态
        HIGH: 0.8       // 高于80%为高能源状态
    },
    
    // 能源状态持续时间常量（单位：tick）
    ENERGY_STATUS_DURATION: {
        CRITICAL: 20,   // 危急状态需要持续20个tick才能转变
        LOW: 30,        // 低能源状态需要持续30个tick才能转变
        NORMAL: 50,     // 正常状态需要持续50个tick才能转变
        HIGH: 40        // 高能源状态需要持续40个tick才能转变
    },
    
    // 获取房间状态
    getRoomStatus: function(room) {
        // 添加检测间隔，减少CPU消耗
        if(!room.memory.lastStatusCheck) {
            room.memory.lastStatusCheck = 0;
        }
        
        // 如果上次检查是在最近20个tick内，则直接返回缓存的结果
        const ticksSinceLastCheck = Game.time - room.memory.lastStatusCheck;
        if(ticksSinceLastCheck < 20 && room.memory.lastRoomStatus) {
            return room.memory.lastRoomStatus;
        }
        
        // 更新最后检查时间
        room.memory.lastStatusCheck = Game.time;
        
        // 计算所有容器中的能量 - 仅用于信息记录，不参与状态管理
        const containers = room.find(FIND_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_CONTAINER
        });
        
        let containerEnergy = 0;
        let containerCapacity = 0;
        
        containers.forEach(container => {
            containerEnergy += container.store[RESOURCE_ENERGY] || 0;
            containerCapacity += container.store.getCapacity(RESOURCE_ENERGY) || 0;
        });
        
        const status = {
            energy: room.energyAvailable,
            energyCapacity: room.energyCapacityAvailable,
            constructionSites: room.find(FIND_CONSTRUCTION_SITES).length,
            damagedStructures: room.find(FIND_STRUCTURES, {
                filter: s => s.hits < s.hitsMax && s.structureType !== STRUCTURE_WALL
            }).length,
            hostiles: room.find(FIND_HOSTILE_CREEPS).length,
            creeps: room.find(FIND_MY_CREEPS).length,
            storage: room.storage ? room.storage.store[RESOURCE_ENERGY] : 0, // 移除容器能量
            storageCapacity: room.storage ? room.storage.store.getCapacity(RESOURCE_ENERGY) : 0, // 移除容器容量
            containers: containers.length,
            containerEnergy: containerEnergy,
            containerCapacity: containerCapacity,
            energyLevel: 0,
            threatLevel: 0,
            performance: {
                cpu: Game.cpu.getUsed()
            }
        };

        // 计算能量水平 - 仅考虑spawn/extension能量
        if (status.energyCapacity > 0) {
            status.energyLevel = status.energy / status.energyCapacity;
        }
        
        // 总体能量水平现在等于spawn/extension能量水平
        status.totalEnergyLevel = status.energyLevel;

        // 计算威胁等级
        if(status.hostiles > 0) {
            const hostiles = room.find(FIND_HOSTILE_CREEPS);
            let threatScore = 0;
            hostiles.forEach(hostile => {
                threatScore += hostile.getActiveBodyparts(ATTACK) * 2;
                threatScore += hostile.getActiveBodyparts(RANGED_ATTACK) * 2;
                threatScore += hostile.getActiveBodyparts(HEAL) * 3;
                threatScore += hostile.getActiveBodyparts(TOUGH);
            });
            status.threatLevel = Math.min(5, Math.ceil(threatScore / 10));
        }
        
        // 保存结果以便下次使用
        room.memory.lastRoomStatus = status;

        return status;
    },

    // 获取紧急状态阈值
    getEmergencyThresholds: function(room) {
        // 获取房间控制器等级
        const rcl = room.controller ? room.controller.level : 0;
        
        // 默认阈值
        let thresholds = {
            severe: 0.1,   // 严重紧急状态阈值
            moderate: 0.2, // 中度紧急状态阈值
            mild: 0.3      // 轻度紧急状态阈值
        };
        
        // 对于不同级别房间，设置不同的阈值
        if(rcl <= 2) {
            thresholds = {
                severe: 0.2,   // 提高严重紧急状态阈值
                moderate: 0.3, // 提高中度紧急状态阈值
                mild: 0.4      // 提高轻度紧急状态阈值
            };
        } else if(rcl <= 4) {  // 为RCL 3-4添加特殊阈值
            thresholds = {
                severe: 0.15,   // 提高严重紧急状态阈值
                moderate: 0.25, // 提高中度紧急状态阈值
                mild: 0.35      // 提高轻度紧急状态阈值
            };
        }
        
        // 如果房间有自定义阈值，使用自定义阈值
        if(room.memory.emergencyThresholds) {
            thresholds = Object.assign({}, thresholds, room.memory.emergencyThresholds);
        }
        
        return thresholds;
    },

    // 检查能量紧急状态
    checkEnergyEmergency: function(room) {
        // 添加安全检查
        if (!room || !room.memory) {
            console.log(`[energyUtils] checkEnergyEmergency: 无效的房间`);
            return { isEmergency: false, level: 0, reason: '无效的房间', adjustedRatios: {} };
        }
        
        // 添加检测间隔，减少CPU消耗
        if(!room.memory.lastEmergencyCheck) {
            room.memory.lastEmergencyCheck = 0;
        }
        
        // 如果上次检查是在最近10个tick内，且不是紧急状态，则直接返回上次的结果
        const ticksSinceLastCheck = Game.time - room.memory.lastEmergencyCheck;
        if(ticksSinceLastCheck < 10 && room.memory.lastEmergencyResult && !room.memory.lastEmergencyResult.isEmergency) {
            return room.memory.lastEmergencyResult;
        }
        
        // 如果处于紧急状态，则每5个tick检查一次
        if(room.memory.lastEmergencyResult && room.memory.lastEmergencyResult.isEmergency && ticksSinceLastCheck < 5) {
            return room.memory.lastEmergencyResult;
        }
        
        // 更新最后检查时间
        room.memory.lastEmergencyCheck = Game.time;
        
        const status = this.getRoomStatus(room);
        const emergency = {
            isEmergency: false,
            level: 0,
            reason: '',
            adjustedRatios: {}
        };
        
        // 使用spawn/extension能量水平判断紧急状态
        const energyLevel = status.energyLevel;
        
        // 计算当前creep数量
        const creepCounts = {};
        _.filter(Game.creeps, creep => creep.room.name === room.name).forEach(creep => {
            creepCounts[creep.memory.role] = (creepCounts[creep.memory.role] || 0) + 1;
        });
        
        // 获取目标比例（如果存在）
        let targetRatios = {};
        if(room.memory.creepRatios) {
            targetRatios = room.memory.creepRatios;
        } else {
            // 默认比例
            targetRatios = {
                harvester: 0.3,
                upgrader: 0.2,
                builder: 0.2,
                repairer: 0.1,
                carrier: 0.2
            };
        }
        
        // 确保targetRatios不为null或undefined
        if (!targetRatios) {
            console.log(`[energyUtils] checkEnergyEmergency: targetRatios 为 ${targetRatios}，使用默认比例`);
            targetRatios = {
                harvester: 0.3,
                upgrader: 0.2,
                builder: 0.2,
                repairer: 0.1,
                carrier: 0.2
            };
        }
        
        // 获取紧急状态阈值
        const emergencyThresholds = this.getEmergencyThresholds(room);
        
        // 检查是否刚刚生产了creep
        const recentlySpawned = this.checkRecentSpawn(room);
        
        // 检查紧急状态持续时间
        if(!room.memory.emergencyStartTime) {
            room.memory.emergencyStartTime = 0;
        }
        
        // 如果当前不是紧急状态，重置计时器
        if(energyLevel >= emergencyThresholds.mild && !room.memory.emergencyFlags) {
            room.memory.emergencyStartTime = 0;
        }
        
        // 如果刚刚生产了creep，暂时不触发紧急状态
        if(recentlySpawned) {
            console.log(`[能量] 房间 ${room.name} 刚刚生产了creep，暂时不触发紧急状态`);
            
            // 如果能量水平极低，仍然触发轻度紧急状态
            if(energyLevel < emergencyThresholds.severe) {
                emergency.isEmergency = true;
                emergency.level = 1; // 只触发轻度紧急状态
                emergency.reason = '能量偏低（刚生产creep）';
                emergency.adjustedRatios = this.adjustRatios(targetRatios, 'harvester', 0.4);
                
                // 记录紧急状态开始时间
                if(room.memory.emergencyStartTime === 0) {
                    room.memory.emergencyStartTime = Game.time;
                }
            } else {
                // 使用原始比例
                emergency.adjustedRatios = Object.assign({}, targetRatios);
                
                // 保存结果并返回
                room.memory.lastEmergencyResult = emergency;
                return emergency;
            }
        } else {
            // 正常判断紧急状态
            if(energyLevel < emergencyThresholds.severe) {
                // 严重紧急状态 - 大幅增加采集者比例
                emergency.isEmergency = true;
                emergency.level = 3;
                emergency.reason = '能量严重不足';
                
                // 调整比例 - 增加采集者，减少其他角色
                emergency.adjustedRatios = this.adjustRatios(targetRatios, 'harvester', 0.8);
                
                // 记录紧急状态开始时间
                if(room.memory.emergencyStartTime === 0) {
                    room.memory.emergencyStartTime = Game.time;
                }
            }
            else if(energyLevel < emergencyThresholds.moderate) {
                // 中度紧急状态
                emergency.isEmergency = true;
                emergency.level = 2;
                emergency.reason = '能量不足';
                
                // 调整比例 - 适度增加采集者
                emergency.adjustedRatios = this.adjustRatios(targetRatios, 'harvester', 0.7);
                
                // 记录紧急状态开始时间
                if(room.memory.emergencyStartTime === 0) {
                    room.memory.emergencyStartTime = Game.time;
                }
            }
            else if(energyLevel < emergencyThresholds.mild) {
                // 轻度紧急状态
                emergency.isEmergency = true;
                emergency.level = 1;
                emergency.reason = '能量偏低';
                
                // 调整比例 - 略微增加采集者
                emergency.adjustedRatios = this.adjustRatios(targetRatios, 'harvester', 0.5);
                
                // 记录紧急状态开始时间
                if(room.memory.emergencyStartTime === 0) {
                    room.memory.emergencyStartTime = Game.time;
                }
            }
            else {
                // 正常状态 - 使用原始比例
                emergency.adjustedRatios = Object.assign({}, targetRatios);
                
                // 如果之前处于紧急状态，现在恢复正常，清除紧急状态
                if(room.memory.emergencyFlags) {
                    this.restoreNormalOperations(room);
                }
            }
        }
        
        // 检查采集者数量是否足够
        const harvesterCount = creepCounts.harvester || 0;
        const totalCreeps = _.sum(Object.values(creepCounts));
        
        // 如果采集者数量过少，无论能量水平如何都进入紧急状态
        if(harvesterCount < 2 && totalCreeps > 0) {
            emergency.isEmergency = true;
            emergency.level = Math.max(emergency.level, 3); // 提高紧急级别
            emergency.reason += ' 采集者数量不足';
            
            // 确保采集者比例至少为80%
            emergency.adjustedRatios = this.adjustRatios(targetRatios, 'harvester', 0.8);
            
            // 记录紧急状态开始时间
            if(room.memory.emergencyStartTime === 0) {
                room.memory.emergencyStartTime = Game.time;
            }
        }
        
        // 检查紧急状态是否持续太久（超过1000个tick）
        const emergencyDuration = Game.time - room.memory.emergencyStartTime;
        const maxEmergencyDuration = room.controller && room.controller.level >= 3 ? 500 : 1000; // RCL 3+减少紧急状态持续时间
        
        // 检查是否有足够的harvester来恢复正常状态
        const harvestPositions = this.countHarvestPositions(room);
        const optimalHarvesters = Math.min(harvestPositions, room.controller ? room.controller.level * 2 : 2);
        const hasEnoughHarvesters = harvesterCount >= optimalHarvesters;
        
        // 检查最近是否有spawn活动
        const recentSpawnActivity = this.checkRecentSpawn(room);
        
        // 如果紧急状态持续时间过长，或者有足够的harvester且最近有spawn活动，则恢复正常状态
        if(emergency.isEmergency && (emergencyDuration > maxEmergencyDuration || 
           (hasEnoughHarvesters && recentSpawnActivity && emergencyDuration > 100))) {
            console.log(`[能量] 房间 ${room.name} 紧急状态结束 (${emergencyDuration} ticks)，` + 
                       `原因: ${emergencyDuration > maxEmergencyDuration ? '持续时间过长' : '采集者数量充足且有spawn活动'}`);
            
            // 强制恢复正常状态
            this.restoreNormalOperations(room);
            
            // 重置紧急状态
            emergency.isEmergency = false;
            emergency.level = 0;
            emergency.reason = '紧急状态结束，恢复正常';
            emergency.adjustedRatios = Object.assign({}, targetRatios);
            
            // 重置计时器
            room.memory.emergencyStartTime = 0;
        }
        
        // 保存结果以便下次使用
        room.memory.lastEmergencyResult = emergency;
        

        return emergency;
    },
    
    // 检查房间是否刚刚生产了creep
    checkRecentSpawn: function(room) {
        // 获取所有spawn
        const spawns = room.find(FIND_MY_SPAWNS);
        
        // 检查是否有spawn正在生产
        for(let spawn of spawns) {
            if(spawn.spawning) {
                return true;
            }
        }
        
        // 检查最近是否有creep被生产
        if(!room.memory.lastSpawnTime) {
            room.memory.lastSpawnTime = 0;
        }
        
        // 如果在过去20个tick内有creep被生产，认为刚刚生产了creep
        const recentlySpawned = Game.time - room.memory.lastSpawnTime < 20;
        
        // 检查是否有新的creep被生产
        if(!recentlySpawned) {
            // 获取房间队列
            if(Memory.spawns && Memory.spawns.queues && Memory.spawns.queues[room.name]) {
                const roomQueue = Memory.spawns.queues[room.name];
                
                // 如果队列中有请求被处理，更新lastSpawnTime
                if(roomQueue.lastProcessedTime && roomQueue.lastProcessedTime > room.memory.lastSpawnTime) {
                    room.memory.lastSpawnTime = roomQueue.lastProcessedTime;
                    return true;
                }
            }
        }
        
        return recentlySpawned;
    },
    
    // 调整角色比例的辅助函数
    adjustRatios: function(originalRatios, priorityRole, targetRatio) {
        // 添加安全检查
        if (!originalRatios) {
            console.log(`[energyUtils] adjustRatios: originalRatios 为 ${originalRatios}`);
            // 创建默认比例
            originalRatios = {
                harvester: 0.3,
                upgrader: 0.2,
                builder: 0.2,
                repairer: 0.1,
                carrier: 0.2
            };
        }
        
        const adjustedRatios = {};
        
        // 确保优先角色达到目标比例
        adjustedRatios[priorityRole] = targetRatio;
        
        // 计算剩余比例
        const remainingRatio = 1 - targetRatio;
        
        // 计算原始比例中除优先角色外的总和
        let originalSum = 0;
        for(let role in originalRatios) {
            if(role !== priorityRole) {
                originalSum += originalRatios[role];
            }
        }
        
        // 如果原始总和为0，平均分配剩余比例
        if(originalSum === 0) {
            const otherRoles = Object.keys(originalRatios).filter(r => r !== priorityRole);
            const equalShare = remainingRatio / Math.max(1, otherRoles.length);
            
            otherRoles.forEach(role => {
                adjustedRatios[role] = equalShare;
            });
        } else {
            // 按比例分配剩余比例
            for(let role in originalRatios) {
                if(role !== priorityRole) {
                    const originalProportion = originalRatios[role] / originalSum;
                    adjustedRatios[role] = remainingRatio * originalProportion;
                }
            }
        }
        
        return adjustedRatios;
    },

    // 添加紧急能量恢复函数
    emergencyEnergyRecovery: function(room) {
        console.log(`[energyUtils] 房间 ${room.name} 启动紧急能量恢复程序`);
        
        // 获取紧急状态
        const emergency = this.checkEnergyEmergency(room);
        
        // 根据紧急程度采取不同措施
        if(emergency.level >= 3) {
            // 严重紧急状态 - 采取所有措施
            console.log(`[energyUtils] 房间 ${room.name} 处于严重紧急状态，采取全面措施`);
            
            // 1. 暂停所有非必要的能量消耗活动
            this.pauseNonEssentialActivities(room);
            
            // 2. 优化现有harvester的工作效率
            this.optimizeHarvesters(room);
            
            // 3. 临时将其他角色转为harvester
            this.convertRolesToHarvesters(room, 0.5); // 转换50%的非harvester
            
            // 4. 检查能量源周围是否有障碍物
            this.checkEnergySourceObstacles(room);
        }
        else if(emergency.level >= 2) {
            // 中度紧急状态 - 采取部分措施
            console.log(`[energyUtils] 房间 ${room.name} 处于中度紧急状态，采取部分措施`);
            
            // 1. 暂停部分非必要的能量消耗活动
            this.pauseNonEssentialActivities(room, false); // 只暂停升级，不暂停建造
            
            // 2. 优化现有harvester的工作效率
            this.optimizeHarvesters(room);
            
            // 3. 临时将部分角色转为harvester
            this.convertRolesToHarvesters(room, 0.3); // 转换30%的非harvester
        }
        else {
            // 轻度紧急状态 - 采取最小措施
            console.log(`[energyUtils] 房间 ${room.name} 处于轻度紧急状态，采取最小措施`);
            
            // 1. 优化现有harvester的工作效率
            this.optimizeHarvesters(room);
            
            // 2. 临时将少量角色转为harvester
            this.convertRolesToHarvesters(room, 0.1); // 转换10%的非harvester
        }
        
        return true;
    },
    
    // 暂停非必要的能量消耗活动
    pauseNonEssentialActivities: function(room, pauseAll = true) {
        // 设置房间标志
        if(!room.memory.emergencyFlags) {
            room.memory.emergencyFlags = {};
        }
        
        // 始终暂停升级
        room.memory.emergencyFlags.pauseUpgrading = true;
        
        // 根据参数决定是否暂停建造
        room.memory.emergencyFlags.pauseBuilding = pauseAll;
        
        // 始终优先采集
        room.memory.emergencyFlags.prioritizeHarvesting = true;
        
        console.log(`[energyUtils] 房间 ${room.name} 暂停非必要能量消耗活动: ${pauseAll ? '全部' : '部分'}`);
    },
    
    // 优化现有harvester的工作效率
    optimizeHarvesters: function(room) {
        // 获取所有harvester
        const harvesters = _.filter(Game.creeps, creep => 
            creep.memory.role === 'harvester' && creep.room.name === room.name
        );
        
        if(harvesters.length === 0) {
            console.log(`[energyUtils] 房间 ${room.name} 没有harvester可以优化`);
            return;
        }
        
        // 获取能量源
        const sources = room.find(FIND_SOURCES);
        
        // 计算每个源的最佳harvester数量
        const sourceData = {};
        sources.forEach(source => {
            // 计算源周围的可用位置
            const terrain = room.getTerrain();
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
            
            sourceData[source.id] = {
                source: source,
                availablePositions: availablePositions,
                currentHarvesters: 0
            };
        });
        
        // 统计每个源当前的harvester数量
        harvesters.forEach(harvester => {
            if(harvester.memory.sourceId && sourceData[harvester.memory.sourceId]) {
                sourceData[harvester.memory.sourceId].currentHarvesters++;
            }
        });
        
        // 重新分配harvester到不同的源
        harvesters.forEach(harvester => {
            // 找出harvester数量少于可用位置的源
            const underutilizedSources = Object.values(sourceData).filter(data => 
                data.currentHarvesters < data.availablePositions
            );
            
            if(underutilizedSources.length > 0) {
                // 按harvester数量排序，优先分配到harvester最少的源
                underutilizedSources.sort((a, b) => a.currentHarvesters - b.currentHarvesters);
                
                // 分配到最需要harvester的源
                const targetSource = underutilizedSources[0];
                harvester.memory.sourceId = targetSource.source.id;
                targetSource.currentHarvesters++;
                
                console.log(`[energyUtils] 重新分配harvester ${harvester.name} 到源 ${targetSource.source.id}`);
            }
        });
    },
    
    // 临时将其他角色转为harvester
    convertRolesToHarvesters: function(room, ratio = 0.5) {
        // 获取非harvester的creeps
        const nonHarvesters = _.filter(Game.creeps, creep => 
            creep.memory.role !== 'harvester' && 
            creep.room.name === room.name &&
            creep.memory.role !== 'defender' && // 保留防御单位
            creep.memory.role !== 'healer' &&
            creep.memory.role !== 'carrier' // 保留运输单位
        );
        
        // 计算需要转换的数量
        const convertCount = Math.floor(nonHarvesters.length * ratio);
        
        if(convertCount === 0) {
            console.log(`[energyUtils] 房间 ${room.name} 没有可转换的creep`);
            return;
        }
        
        // 按优先级排序（优先转换upgrader和builder）
        nonHarvesters.sort((a, b) => {
            const priorityA = a.memory.role === 'upgrader' || a.memory.role === 'builder' ? 1 : 0;
            const priorityB = b.memory.role === 'upgrader' || b.memory.role === 'builder' ? 1 : 0;
            return priorityB - priorityA;
        });
        
        // 转换前N个creep
        for(let i = 0; i < convertCount; i++) {
            const creep = nonHarvesters[i];
            console.log(`[energyUtils] 临时将 ${creep.name} 从 ${creep.memory.role} 转换为harvester`);
            
            // 保存原始角色以便恢复
            creep.memory.originalRole = creep.memory.role;
            creep.memory.role = 'harvester';
            creep.memory.temporaryHarvester = true;
        }
        
        console.log(`[energyUtils] 房间 ${room.name} 临时转换了 ${convertCount} 个creep为harvester (${Math.round(ratio * 100)}%)`);
    },
    
    // 检查能量源周围是否有障碍物
    checkEnergySourceObstacles: function(room) {
        const sources = room.find(FIND_SOURCES);
        
        sources.forEach(source => {
            // 检查源周围是否有可以清除的障碍物
            const obstacles = room.lookForAtArea(LOOK_STRUCTURES, 
                Math.max(0, source.pos.y - 1),
                Math.max(0, source.pos.x - 1),
                Math.min(49, source.pos.y + 1),
                Math.min(49, source.pos.x + 1),
                true
            ).filter(item => 
                item.structure.structureType !== STRUCTURE_CONTAINER &&
                item.structure.structureType !== STRUCTURE_ROAD &&
                item.structure.structureType !== STRUCTURE_EXTRACTOR
            );
            
            if(obstacles.length > 0) {
                console.log(`[energyUtils] 发现能量源 ${source.id} 周围有 ${obstacles.length} 个障碍物`);
                
                // 标记这些障碍物以便清除
                obstacles.forEach(item => {
                    if(!room.memory.obstaclesToClear) {
                        room.memory.obstaclesToClear = [];
                    }
                    
                    room.memory.obstaclesToClear.push({
                        id: item.structure.id,
                        type: item.structure.structureType,
                        x: item.structure.pos.x,
                        y: item.structure.pos.y
                    });
                });
            }
        });
    },
    
    // 恢复正常操作
    restoreNormalOperations: function(room) {
        if(!room.memory.emergencyFlags) return;
        
        // 恢复正常活动
        delete room.memory.emergencyFlags.pauseBuilding;
        delete room.memory.emergencyFlags.pauseUpgrading;
        delete room.memory.emergencyFlags.prioritizeHarvesting;
        
        // 恢复临时转换的harvester
        const temporaryHarvesters = _.filter(Game.creeps, creep => 
            creep.memory.temporaryHarvester && 
            creep.room.name === room.name
        );
        
        temporaryHarvesters.forEach(creep => {
            if(creep.memory.originalRole) {
                console.log(`[energyUtils] 恢复 ${creep.name} 从临时harvester到 ${creep.memory.originalRole}`);
                creep.memory.role = creep.memory.originalRole;
                delete creep.memory.originalRole;
                delete creep.memory.temporaryHarvester;
            }
        });
        
        console.log(`[energyUtils] 房间 ${room.name} 恢复正常运营`);
    },
    
    // 计算可开采位置数量
    countHarvestPositions: function(room) {
        // 如果已经计算过并缓存了结果，直接返回
        if(room.memory.harvestPositions !== undefined) {
            return room.memory.harvestPositions;
        }
        
        const sources = room.find(FIND_SOURCES);
        let totalPositions = 0;
        
        for(let source of sources) {
            // 计算源周围的可用位置
            let availablePositions = 0;
            const terrain = room.getTerrain();
            
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
            
            // 每个源至少有1个位置
            totalPositions += Math.max(1, availablePositions);
        }
        
        // 确保至少有2个位置（防止房间没有源的情况）
        const result = Math.max(2, totalPositions);
        
        // 缓存结果
        room.memory.harvestPositions = result;
        
        return result;
    },

    // 根据控制器等级获取能源阈值
    getEnergyThresholds: function(rcl) {
        // 根据控制器等级调整阈值
        let thresholds = { ...this.ENERGY_THRESHOLDS };
        
        // 对于低等级房间，提高阈值
        if (rcl <= 2) {
            thresholds.CRITICAL = 0.3;  // 低于30%为危急状态
            thresholds.LOW = 0.5;       // 低于50%为低能源状态
        } else if (rcl <= 4) {
            thresholds.CRITICAL = 0.25; // 低于25%为危急状态
            thresholds.LOW = 0.45;      // 低于45%为低能源状态
        }
        
        return thresholds;
    },

    // 检查房间能源状态
    checkEnergyStatus: function(room) {
        // 添加安全检查
        if (!room || !room.controller) {
            console.log(`[energyUtils] checkEnergyStatus: 无效的房间`);
            return null;
        }
        
        // 初始化能源状态
        if (!room.memory.energyStatus) {
            room.memory.energyStatus = {
                currentStatus: 'normal',
                lastStatusChange: Game.time,
                energyLevel: 0,
                harvestPositions: this.countHarvestPositions(room)
            };
        }
        
        // 获取当前能源状态
        const status = room.memory.energyStatus;
        
        // 计算能源水平
        const energyAvailable = room.energyAvailable;
        const energyCapacity = room.energyCapacityAvailable;
        const energyLevel = energyCapacity > 0 ? energyAvailable / energyCapacity : 0;
        
        // 更新能源水平
        status.energyLevel = energyLevel;
        
        // 获取控制器等级
        const rcl = room.controller.level;
        
        // 获取能源阈值
        const thresholds = this.getEnergyThresholds(rcl);
        
        // 确定当前状态
        let newStatus = 'normal';
        if (energyLevel < thresholds.CRITICAL) {
            newStatus = 'critical';
        } else if (energyLevel < thresholds.LOW) {
            newStatus = 'low';
        } else if (energyLevel > thresholds.HIGH) {
            newStatus = 'high';
        }
        
        // 检查是否需要更新状态
        if (newStatus !== status.currentStatus) {
            // 检查状态持续时间
            const statusDuration = Game.time - status.lastStatusChange;
            const requiredDuration = this.ENERGY_STATUS_DURATION[status.currentStatus.toUpperCase()] || 0;
            
            // 如果状态持续时间足够长，或者是向更糟糕的状态转变，则更新状态
            if (statusDuration >= requiredDuration || 
                (newStatus === 'critical' && status.currentStatus !== 'critical') ||
                (newStatus === 'low' && status.currentStatus === 'normal') ||
                (newStatus === 'low' && status.currentStatus === 'high')) {
                
                // 更新状态
                status.currentStatus = newStatus;
                status.lastStatusChange = Game.time;
                
                // 记录状态变化
                console.log(`房间 ${room.name} 能源状态变为 ${newStatus} (${Math.floor(energyLevel * 100)}%)`);
            }
        }
        
        // 更新房间内存
        room.memory.energyStatus = status;
        
        return status;
    }
}; 