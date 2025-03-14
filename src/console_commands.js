/**
 * 控制台命令模块
 * 提供可以在Screeps控制台中直接复制粘贴运行的命令
 * 现在改为模块导出格式，可以被main.js引用
 */

module.exports = {
    init: function() {
        // 初始化控制台命令
        console.log('控制台命令模块已初始化');
        
        // 将命令添加到全局对象
        global.checkEnergy = function(roomName) {
            const room = Game.rooms[roomName || 'E3S41'];
            if(room) {
                const energyUtils = require('energyUtils');
                const status = energyUtils.getRoomStatus(room);
                console.log(`房间能量: ${status.energy}/${status.energyCapacity} (${Math.round(status.energyLevel * 100)}%)`);
                console.log(`容器能量: ${status.containerEnergy}/${status.containerCapacity} (${status.containers}个容器) - 仅供参考，不参与状态管理`);
                
                // 显示能量水平信息
                console.log(`能量水平: ${Math.round(status.energyLevel * 100)}%`);
                
                // 检查紧急状态
                const emergency = energyUtils.checkEnergyEmergency(room);
                console.log(`紧急状态: ${emergency.isEmergency ? '是' : '否'}, 级别: ${emergency.level}, 原因: ${emergency.reason}`);
                
                // 显示当前creep角色分布
                const creepCounts = {};
                let totalCreeps = 0;
                
                _.filter(Game.creeps, creep => creep.room.name === room.name).forEach(creep => {
                    creepCounts[creep.memory.role] = (creepCounts[creep.memory.role] || 0) + 1;
                    totalCreeps++;
                });
                
                console.log(`当前Creep分布 (总数: ${totalCreeps}):`);
                for(let role in creepCounts) {
                    const count = creepCounts[role];
                    const percent = Math.round((count / totalCreeps) * 100);
                    console.log(`  ${role}: ${count} (${percent}%)`);
                }
                
                // 如果处于紧急状态，显示调整后的角色比例
                if(emergency.isEmergency && emergency.adjustedRatios) {
                    console.log(`紧急状态下的目标角色比例:`);
                    for(let role in emergency.adjustedRatios) {
                        const ratio = emergency.adjustedRatios[role];
                        const targetCount = Math.ceil(totalCreeps * ratio);
                        console.log(`  ${role}: ${Math.round(ratio * 100)}% (目标: ${targetCount})`);
                    }
                }
                
                // 显示紧急状态阈值
                const thresholds = energyUtils.getEmergencyThresholds(room);
                console.log(`紧急状态阈值:`);
                console.log(`- 严重紧急: < ${Math.round(thresholds.severe * 100)}%`);
                console.log(`- 中度紧急: < ${Math.round(thresholds.moderate * 100)}%`);
                console.log(`- 轻度紧急: < ${Math.round(thresholds.mild * 100)}%`);
            } else {
                console.log(`无法访问房间 ${roomName || 'E3S41'}`);
            }
        };
        
        global.setEmergencyThresholds = function(roomName, severe, moderate, mild) {
            const room = Game.rooms[roomName || 'E3S41'];
            if(room) {
                room.memory.emergencyThresholds = {
                    severe: severe / 100,
                    moderate: moderate / 100,
                    mild: mild / 100
                };
                console.log(`已设置房间 ${room.name} 的紧急状态阈值:`);
                console.log(`- 严重紧急: < ${severe}%`);
                console.log(`- 中度紧急: < ${moderate}%`);
                console.log(`- 轻度紧急: < ${mild}%`);
            } else {
                console.log(`无法访问房间 ${roomName || 'E3S41'}`);
            }
        };
        
        global.clearEmergencyThresholds = function(roomName) {
            const room = Game.rooms[roomName || 'E3S41'];
            if(room && room.memory.emergencyThresholds) {
                delete room.memory.emergencyThresholds;
                console.log('已清除自定义紧急状态阈值，将使用默认阈值');
                
                // 显示当前阈值
                const energyUtils = require('energyUtils');
                const thresholds = energyUtils.getEmergencyThresholds(room);
                console.log(`当前紧急状态阈值:`);
                console.log(`- 严重紧急: < ${Math.round(thresholds.severe * 100)}%`);
                console.log(`- 中度紧急: < ${Math.round(thresholds.moderate * 100)}%`);
                console.log(`- 轻度紧急: < ${Math.round(thresholds.mild * 100)}%`);
            } else {
                console.log(`无法访问房间 ${roomName || 'E3S41'} 或没有自定义阈值`);
            }
        };
        
        // 添加查看当前房间所有creep信息的命令
        global.creepInfo = function(roomName) {
            // 如果没有提供房间名，使用默认房间
            const room = Game.rooms[roomName];
            if(!room) {
                console.log(`找不到房间: ${roomName}。请提供有效的房间名。`);
                return;
            }
            
            // 获取房间中的所有creep
            const creeps = _.filter(Game.creeps, creep => creep.room.name === room.name);
            if(creeps.length === 0) {
                console.log(`房间 ${room.name} 中没有creep。`);
                return;
            }
            
            // 按角色分组
            const creepsByRole = _.groupBy(creeps, creep => creep.memory.role);
            
            // 输出总体统计信息
            console.log(`房间 ${room.name} 的creep信息 (总数: ${creeps.length}):`);
            console.log('======================================');
            
            // 输出每个角色的统计信息
            for(let role in creepsByRole) {
                const roleCreeps = creepsByRole[role];
                console.log(`\n【${role}】 - ${roleCreeps.length}个`);
                
                // 计算平均体型
                const bodyParts = {};
                roleCreeps.forEach(creep => {
                    creep.body.forEach(part => {
                        bodyParts[part.type] = (bodyParts[part.type] || 0) + 1;
                    });
                });
                
                // 输出平均体型
                let bodyInfo = '平均体型: ';
                for(let part in bodyParts) {
                    bodyInfo += `${part}=${Math.round(bodyParts[part] / roleCreeps.length)} `;
                }
                console.log(bodyInfo);
                
                // 输出每个creep的详细信息
                roleCreeps.forEach(creep => {
                    // 计算剩余寿命
                    const ticksToLive = creep.ticksToLive || 'N/A';
                    
                    // 计算能量状态
                    const energyStatus = creep.store[RESOURCE_ENERGY] > 0 ? 
                        `${creep.store[RESOURCE_ENERGY]}/${creep.store.getCapacity()}` : 
                        '空';
                    
                    // 获取当前状态
                    const status = creep.memory.working ? '工作中' : '采集中';
                    
                    // 获取特殊状态
                    let specialStatus = '';
                    if(creep.memory.temporaryHarvester) {
                        specialStatus = `(临时harvester，原角色: ${creep.memory.originalRole})`;
                    }
                    if(creep.memory.emergency) {
                        specialStatus += ' [紧急]';
                    }
                    
                    // 输出creep信息
                    console.log(`  ${creep.name} - 寿命: ${ticksToLive}, 能量: ${energyStatus}, 状态: ${status} ${specialStatus}`);
                    
                    // 输出特定角色的额外信息
                    if(role === 'harvester' && creep.memory.sourceId) {
                        const source = Game.getObjectById(creep.memory.sourceId);
                        if(source) {
                            console.log(`    采集源: ${source.id} (位置: ${source.pos.x},${source.pos.y})`);
                        }
                    }
                    
                    // 输出当前位置
                    console.log(`    位置: ${creep.pos.x},${creep.pos.y}`);
                });
            }
            
            // 输出紧急状态信息
            const energyUtils = require('energyUtils');
            const emergency = energyUtils.checkEnergyEmergency(room);
            if(emergency.isEmergency) {
                console.log('\n紧急状态信息:');
                console.log(`  级别: ${emergency.level}, 原因: ${emergency.reason}`);
                console.log(`  持续时间: ${Game.time - room.memory.emergencyStartTime} ticks`);
                
                // 显示调整后的角色比例
                console.log('  调整后的角色比例:');
                for(let role in emergency.adjustedRatios) {
                    console.log(`    ${role}: ${Math.round(emergency.adjustedRatios[role] * 100)}%`);
                }
            }
            
            // 输出孵化队列信息
            if(Memory.spawns && Memory.spawns.queues && Memory.spawns.queues[room.name]) {
                const queue = Memory.spawns.queues[room.name].queue;
                if(queue && queue.length > 0) {
                    console.log('\n孵化队列:');
                    queue.forEach((req, i) => {
                        console.log(`  ${i+1}. ${req.role} (优先级: ${req.priority})`);
                    });
                }
            }
        };
        
        // 添加更多控制台命令...
    }
};

// 以下是原始的控制台命令，保留作为参考
// 这些命令可以直接复制到控制台运行

/*
// 命令7: 手动触发紧急能量恢复
const room = Game.rooms['E3S41'];
if(room) {
    const energyUtils = require('energyUtils');
    energyUtils.emergencyEnergyRecovery(room);
    console.log('已手动触发紧急能量恢复程序');
}
*/

// ... 保留其他原始命令 ...

// 命令8: 检查房间能量状态（包括容器）
/*
const room = Game.rooms['E3S41'];
if(room) {
    const energyUtils = require('energyUtils');
    const status = energyUtils.getRoomStatus(room);
    console.log(`房间能量: ${status.energy}/${status.energyCapacity} (${Math.round(status.energyLevel * 100)}%)`);
    console.log(`容器能量: ${status.containerEnergy}/${status.containerCapacity} (${status.containers}个容器)`);
    console.log(`总体能量水平: ${Math.round(status.totalEnergyLevel * 100)}%`);
    
    // 检查紧急状态
    const emergency = energyUtils.checkEnergyEmergency(room);
    console.log(`紧急状态: ${emergency.isEmergency ? '是' : '否'}, 级别: ${emergency.level}, 原因: ${emergency.reason}`);
    
    // 显示当前creep角色分布
    const creepCounts = {};
    let totalCreeps = 0;
    
    _.filter(Game.creeps, creep => creep.room.name === room.name).forEach(creep => {
        creepCounts[creep.memory.role] = (creepCounts[creep.memory.role] || 0) + 1;
        totalCreeps++;
    });
    
    console.log(`当前Creep分布 (总数: ${totalCreeps}):`);
    for(let role in creepCounts) {
        const count = creepCounts[role];
        const percent = Math.round((count / totalCreeps) * 100);
        console.log(`  ${role}: ${count} (${percent}%)`);
    }
    
    // 如果处于紧急状态，显示调整后的角色比例
    if(emergency.isEmergency && emergency.adjustedRatios) {
        console.log(`紧急状态下的目标角色比例:`);
        for(let role in emergency.adjustedRatios) {
            const ratio = emergency.adjustedRatios[role];
            const targetCount = Math.ceil(totalCreeps * ratio);
            const currentCount = creepCounts[role] || 0;
            const diff = targetCount - currentCount;
            
            console.log(`  ${role}: ${Math.round(ratio * 100)}% (目标: ${targetCount}, 当前: ${currentCount}, 差距: ${diff})`);
        }
    }
}
*/

// 命令9: 恢复正常操作
/*
const room = Game.rooms['E3S41'];
if(room) {
    const energyUtils = require('energyUtils');
    energyUtils.restoreNormalOperations(room);
    console.log('已手动恢复正常操作');
}
*/

// 命令10: 设置自定义角色比例
/*
const room = Game.rooms['E3S41'];
if(room) {
    // 设置自定义角色比例
    room.memory.creepRatios = {
        harvester: 0.3,  // 30%
        upgrader: 0.2,   // 20%
        builder: 0.2,    // 20%
        repairer: 0.1,   // 10%
        carrier: 0.2     // 20%
    };
    console.log('已设置自定义角色比例');
}
*/

// 命令11: 清除自定义角色比例（恢复默认）
/*
const room = Game.rooms['E3S41'];
if(room && room.memory.creepRatios) {
    delete room.memory.creepRatios;
    console.log('已清除自定义角色比例，将使用默认比例');
}
*/

// 命令12: 检查和修复孵化队列中的优先级问题
/*
const room = Game.rooms['E3S41'];
if(room) {
    // 获取房间队列
    const roomQueue = Memory.spawns.queues[room.name];
    if(!roomQueue || !roomQueue.queue) {
        console.log('房间没有孵化队列');
        return;
    }
    
    // 获取能量状态
    const energyUtils = require('energyUtils');
    const emergency = energyUtils.checkEnergyEmergency(room);
    
    console.log(`当前队列状态 (${roomQueue.queue.length}个请求):`);
    roomQueue.queue.forEach((req, i) => {
        console.log(`  ${i+1}. ${req.role} (优先级: ${req.priority})`);
    });
    
    // 如果处于紧急状态，检查是否需要修复
    if(emergency.isEmergency && emergency.level >= 2) {
        // 计算当前harvester数量
        const harvesterCount = _.filter(Game.creeps, c => 
            c.memory.role === 'harvester' && c.room.name === room.name
        ).length;
        
        // 计算目标harvester数量
        const roomCreepCount = _.filter(Game.creeps, c => c.room.name === room.name).length;
        const targetHarvesterCount = Math.ceil(roomCreepCount * (emergency.adjustedRatios.harvester || 0.3));
        
        console.log(`Harvester: 当前 ${harvesterCount}, 目标 ${targetHarvesterCount}`);
        
        // 检查队列中是否有harvester请求
        const harvesterRequests = roomQueue.queue.filter(req => req.role === 'harvester');
        
        if(harvesterCount < targetHarvesterCount) {
            // 需要更多harvester
            if(harvesterRequests.length === 0) {
                // 添加紧急harvester
                console.log('队列中没有harvester请求，添加一个紧急harvester');
                
                roomQueue.queue.push({
                    role: 'harvester',
                    priority: -100,
                    body: [WORK, CARRY, MOVE],
                    timeAdded: Game.time,
                    memory: {
                        emergency: true
                    }
                });
            } else {
                // 确保harvester请求有最高优先级
                harvesterRequests.forEach(req => {
                    if(req.priority > -100) {
                        console.log(`将harvester请求的优先级从 ${req.priority} 调整为 -100`);
                        req.priority = -100;
                    }
                });
            }
            
            // 调整其他请求的优先级
            roomQueue.queue.forEach(req => {
                if(req.role !== 'harvester') {
                    if(req.role === 'carrier') {
                        console.log(`将 ${req.role} 请求的优先级从 ${req.priority} 调整为 100`);
                        req.priority = 100;
                    } else if(req.role === 'builder' || req.role === 'repairer') {
                        console.log(`将 ${req.role} 请求的优先级从 ${req.priority} 调整为 200`);
                        req.priority = 200;
                    } else {
                        console.log(`将 ${req.role} 请求的优先级从 ${req.priority} 调整为 300`);
                        req.priority = 300;
                    }
                }
            });
            
            // 重新排序队列
            roomQueue.queue.sort((a, b) => a.priority - b.priority);
            
            console.log('队列已修复并重新排序');
        } else {
            console.log('Harvester数量足够，无需修复队列');
        }
    } else {
        console.log('房间不处于紧急状态，无需修复队列');
    }
}
*/

// 命令13: 清空孵化队列
/*
const room = Game.rooms['E3S41'];
if(room && Memory.spawns && Memory.spawns.queues && Memory.spawns.queues[room.name]) {
    Memory.spawns.queues[room.name].queue = [];
    console.log('已清空孵化队列');
}
*/

// 命令14: 检查房间能量状态和紧急状态判断
/*
const room = Game.rooms['E3S41'];
if(room) {
    const energyUtils = require('energyUtils');
    const status = energyUtils.getRoomStatus(room);
    const rcl = room.controller ? room.controller.level : 0;
    
    // 显示基本信息
    console.log(`房间 ${room.name} (RCL ${rcl}) 能量状态:`);
    console.log(`- 房间能量: ${status.energy}/${status.energyCapacity} (${Math.round(status.energyLevel * 100)}%)`);
    console.log(`- 容器能量: ${status.containerEnergy}/${status.containerCapacity} (${status.containers}个容器)`);
    
    // 显示权重信息
    let spawnWeight = 0.7;
    let containerWeight = 0.3;
    if(rcl <= 2) {
        spawnWeight = 0.9;
        containerWeight = 0.1;
    }
    console.log(`- 权重: Spawn/Extension=${spawnWeight*100}%, 容器=${containerWeight*100}%`);
    
    // 显示加权计算
    const spawnEnergyLevel = status.energyCapacity > 0 ? status.energy / status.energyCapacity : 0;
    const containerEnergyLevel = status.containerCapacity > 0 ? status.containerEnergy / status.containerCapacity : 0;
    console.log(`- 加权计算: (${Math.round(spawnEnergyLevel * 100)}% × ${spawnWeight}) + (${Math.round(containerEnergyLevel * 100)}% × ${containerWeight}) = ${Math.round(status.totalEnergyLevel * 100)}%`);
    
    // 计算紧急状态阈值
    let emergencyThresholds = {
        severe: 0.1,
        moderate: 0.2,
        mild: 0.3
    };
    
    if(rcl <= 2) {
        emergencyThresholds = {
            severe: 0.2,
            moderate: 0.3,
            mild: 0.4
        };
    }
    
    console.log(`\n紧急状态阈值 (RCL ${rcl}):`);
    console.log(`- 严重紧急: < ${Math.round(emergencyThresholds.severe * 100)}%`);
    console.log(`- 中度紧急: < ${Math.round(emergencyThresholds.moderate * 100)}%`);
    console.log(`- 轻度紧急: < ${Math.round(emergencyThresholds.mild * 100)}%`);
    
    // 检查是否刚刚生产了creep
    const recentlySpawned = energyUtils.checkRecentSpawn(room);
    console.log(`\n最近是否生产了creep: ${recentlySpawned ? '是' : '否'}`);
    
    if(recentlySpawned) {
        console.log(`最后生产时间: ${room.memory.lastSpawnTime} (${Game.time - room.memory.lastSpawnTime} tick前)`);
    }
    
    // 检查紧急状态
    const emergency = energyUtils.checkEnergyEmergency(room);
    console.log(`\n紧急状态: ${emergency.isEmergency ? '是' : '否'}, 级别: ${emergency.level}, 原因: ${emergency.reason}`);
    
    // 检查容器能量是否会触发紧急状态
    if(status.containers > 0 && status.containerEnergy < 100 * status.containers) {
        if(status.energyLevel >= 0.8) {
            console.log(`容器能量不足，但因为Spawn/Extension能量充足 (${Math.round(status.energyLevel * 100)}%)，不会触发紧急状态`);
        } else {
            console.log(`容器能量不足，且Spawn/Extension能量也不足 (${Math.round(status.energyLevel * 100)}%)，会触发紧急状态`);
        }
    }
    
    // 显示当前creep角色分布
    const creepCounts = {};
    let totalCreeps = 0;
    
    _.filter(Game.creeps, creep => creep.room.name === room.name).forEach(creep => {
        creepCounts[creep.memory.role] = (creepCounts[creep.memory.role] || 0) + 1;
        totalCreeps++;
    });
    
    console.log(`\n当前Creep分布 (总数: ${totalCreeps}):`);
    for(let role in creepCounts) {
        const count = creepCounts[role];
        const percent = Math.round((count / totalCreeps) * 100);
        console.log(`  ${role}: ${count} (${percent}%)`);
    }
    
    // 如果处于紧急状态，显示调整后的角色比例
    if(emergency.isEmergency && emergency.adjustedRatios) {
        console.log(`\n紧急状态下的目标角色比例:`);
        for(let role in emergency.adjustedRatios) {
            const ratio = emergency.adjustedRatios[role];
            const targetCount = Math.ceil(totalCreeps * ratio);
            const currentCount = creepCounts[role] || 0;
            const diff = targetCount - currentCount;
            
            console.log(`  ${role}: ${Math.round(ratio * 100)}% (目标: ${targetCount}, 当前: ${currentCount}, 差距: ${diff})`);
        }
    }
    
    // 检查孵化队列
    if(Memory.spawns && Memory.spawns.queues && Memory.spawns.queues[room.name]) {
        const roomQueue = Memory.spawns.queues[room.name];
        
        console.log(`\n孵化队列 (${roomQueue.queue ? roomQueue.queue.length : 0}个请求):`);
        if(roomQueue.queue && roomQueue.queue.length > 0) {
            roomQueue.queue.forEach((req, i) => {
                console.log(`  ${i+1}. ${req.role} (优先级: ${req.priority})`);
            });
        } else {
            console.log('  队列为空');
        }
    }
}
*/ 

// 命令15: 设置自定义紧急状态阈值
/*
const room = Game.rooms['E3S41'];
if(room) {
    // 设置自定义紧急状态阈值
    room.memory.emergencyThresholds = {
        severe: 0.3,   // 严重紧急状态阈值
        moderate: 0.4, // 中度紧急状态阈值
        mild: 0.5      // 轻度紧急状态阈值
    };
    console.log('已设置自定义紧急状态阈值');
    
    // 显示当前阈值
    const energyUtils = require('energyUtils');
    const thresholds = energyUtils.getEmergencyThresholds(room);
    console.log(`当前紧急状态阈值:`);
    console.log(`- 严重紧急: < ${Math.round(thresholds.severe * 100)}%`);
    console.log(`- 中度紧急: < ${Math.round(thresholds.moderate * 100)}%`);
    console.log(`- 轻度紧急: < ${Math.round(thresholds.mild * 100)}%`);
}
*/

// 命令16: 清除自定义紧急状态阈值（恢复默认）
/*
const room = Game.rooms['E3S41'];
if(room && room.memory.emergencyThresholds) {
    delete room.memory.emergencyThresholds;
    console.log('已清除自定义紧急状态阈值，将使用默认阈值');
    
    // 显示当前阈值
    const energyUtils = require('energyUtils');
    const thresholds = energyUtils.getEmergencyThresholds(room);
    console.log(`当前紧急状态阈值:`);
    console.log(`- 严重紧急: < ${Math.round(thresholds.severe * 100)}%`);
    console.log(`- 中度紧急: < ${Math.round(thresholds.moderate * 100)}%`);
    console.log(`- 轻度紧急: < ${Math.round(thresholds.mild * 100)}%`);
}
*/ 