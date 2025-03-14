/**
 * 城墙管理系统
 * 用于管理城墙的自动维护和控制
 */

module.exports = {
    // 主运行函数
    run: function(room) {
        // 每10个tick运行一次
        if(Game.time % 10 !== 0) return;
        
        // 检查房间控制器等级
        if(!room.controller || room.controller.level < 2) return;
        
        // 初始化内存
        if(!room.memory.rampartManager) {
            this.initializeMemory(room);
        }
        
        try {
            // 更新城墙状态
            this.updateRampartStatus(room);
            
            // 管理城墙维护
            this.manageRampartMaintenance(room);
            
            // 管理城墙开关
            this.manageRampartToggle(room);
            
            // 可视化城墙状态
            this.visualizeRampartStatus(room);
        } catch(error) {
            console.log(`房间 ${room.name} 城墙管理系统错误：${error}`);
        }
    },
    
    // 初始化内存
    initializeMemory: function(room) {
        room.memory.rampartManager = {
            status: {
                totalRamparts: 0,
                averageHits: 0,
                minHits: 0,
                maxHits: 0,
                criticalCount: 0,
                weakCount: 0,
                strongCount: 0,
                publicCount: 0,
                privateCount: 0
            },
            maintenance: {
                targetHits: this.getTargetHits(room),
                priorityList: [],
                lastUpdate: Game.time
            },
            toggle: {
                publicRamparts: [],
                toggleSchedule: {},
                lastToggle: Game.time
            }
        };
    },
    
    // 更新城墙状态
    updateRampartStatus: function(room) {
        const rampartManager = room.memory.rampartManager;
        const ramparts = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_RAMPART
        });
        
        // 更新基本统计信息
        rampartManager.status.totalRamparts = ramparts.length;
        
        if(ramparts.length === 0) return;
        
        // 计算生命值统计
        let totalHits = 0;
        let minHits = Infinity;
        let maxHits = 0;
        let criticalCount = 0;
        let weakCount = 0;
        let strongCount = 0;
        let publicCount = 0;
        let privateCount = 0;
        
        // 获取目标生命值
        const targetHits = rampartManager.maintenance.targetHits;
        
        // 更新优先级列表
        rampartManager.maintenance.priorityList = [];
        
        ramparts.forEach(rampart => {
            // 更新统计信息
            totalHits += rampart.hits;
            minHits = Math.min(minHits, rampart.hits);
            maxHits = Math.max(maxHits, rampart.hits);
            
            // 分类统计
            if(rampart.hits < 10000) {
                criticalCount++;
            } else if(rampart.hits < targetHits * 0.5) {
                weakCount++;
            } else if(rampart.hits >= targetHits) {
                strongCount++;
            }
            
            // 公开/私有统计
            if(rampart.isPublic) {
                publicCount++;
            } else {
                privateCount++;
            }
            
            // 添加到优先级列表
            rampartManager.maintenance.priorityList.push({
                id: rampart.id,
                hits: rampart.hits,
                pos: {x: rampart.pos.x, y: rampart.pos.y},
                priority: this.calculatePriority(rampart, targetHits)
            });
        });
        
        // 更新统计信息
        rampartManager.status.averageHits = Math.floor(totalHits / ramparts.length);
        rampartManager.status.minHits = minHits;
        rampartManager.status.maxHits = maxHits;
        rampartManager.status.criticalCount = criticalCount;
        rampartManager.status.weakCount = weakCount;
        rampartManager.status.strongCount = strongCount;
        rampartManager.status.publicCount = publicCount;
        rampartManager.status.privateCount = privateCount;
        
        // 按优先级排序
        rampartManager.maintenance.priorityList.sort((a, b) => a.priority - b.priority);
        
        // 更新时间戳
        rampartManager.maintenance.lastUpdate = Game.time;
    },
    
    // 计算优先级
    calculatePriority: function(rampart, targetHits) {
        // 优先级计算公式：越低越优先
        // 1. 生命值低于10000的城墙优先级最高
        if(rampart.hits < 10000) {
            return 1;
        }
        
        // 2. 生命值低于目标值一半的城墙次优先
        if(rampart.hits < targetHits * 0.5) {
            return 2 + (rampart.hits / (targetHits * 0.5));
        }
        
        // 3. 生命值低于目标值的城墙再次优先
        if(rampart.hits < targetHits) {
            return 4 + (rampart.hits / targetHits);
        }
        
        // 4. 生命值高于目标值的城墙最低优先级
        return 10 + (rampart.hits / targetHits);
    },
    
    // 管理城墙维护
    manageRampartMaintenance: function(room) {
        const rampartManager = room.memory.rampartManager;
        
        // 更新目标生命值
        rampartManager.maintenance.targetHits = this.getTargetHits(room);
        
        // 如果没有城墙，返回
        if(rampartManager.status.totalRamparts === 0) return;
        
        // 检查是否有维修任务
        if(!room.memory.tasks) {
            room.memory.tasks = [];
        }
        
        // 检查是否已经有城墙维修任务
        const existingTask = room.memory.tasks.find(task => task.type === 'repairRampart');
        
        // 如果有紧急情况（生命值低于10000的城墙），添加紧急维修任务
        if(rampartManager.status.criticalCount > 0 && !existingTask) {
            // 获取最高优先级的城墙
            const target = rampartManager.maintenance.priorityList[0];
            
            // 添加维修任务
            room.memory.tasks.push({
                id: `repairRampart_${Game.time}`,
                type: 'repairRampart',
                targetId: target.id,
                priority: 2, // 高优先级
                creepCount: 1,
                created: Game.time
            });
            
            console.log(`[RampartManager] 添加紧急城墙维修任务：${target.id}`);
        }
        // 如果有弱城墙但没有紧急情况，添加常规维修任务
        else if(rampartManager.status.weakCount > 0 && !existingTask) {
            // 获取最高优先级的城墙
            const target = rampartManager.maintenance.priorityList[0];
            
            // 添加维修任务
            room.memory.tasks.push({
                id: `repairRampart_${Game.time}`,
                type: 'repairRampart',
                targetId: target.id,
                priority: 4, // 中等优先级
                creepCount: 1,
                created: Game.time
            });
            
            console.log(`[RampartManager] 添加常规城墙维修任务：${target.id}`);
        }
    },
    
    // 管理城墙开关
    manageRampartToggle: function(room) {
        const rampartManager = room.memory.rampartManager;
        
        // 更新公开城墙列表
        rampartManager.toggle.publicRamparts = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_RAMPART && s.isPublic
        }).map(r => r.id);
        
        // 处理开关计划
        for(let rampartId in rampartManager.toggle.toggleSchedule) {
            const schedule = rampartManager.toggle.toggleSchedule[rampartId];
            
            // 检查是否到达切换时间
            if(Game.time >= schedule.toggleTime) {
                const rampart = Game.getObjectById(rampartId);
                
                if(rampart) {
                    // 切换城墙状态
                    rampart.setPublic(schedule.setPublic);
                    console.log(`[RampartManager] 城墙 ${rampartId} 已切换为 ${schedule.setPublic ? '公开' : '私有'}`);
                }
                
                // 移除计划
                delete rampartManager.toggle.toggleSchedule[rampartId];
            }
        }
        
        // 检查是否有敌人
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        
        // 如果有敌人，关闭所有公开城墙
        if(hostiles.length > 0 && rampartManager.toggle.publicRamparts.length > 0) {
            console.log(`[RampartManager] 检测到敌人，关闭所有公开城墙`);
            
            rampartManager.toggle.publicRamparts.forEach(rampartId => {
                const rampart = Game.getObjectById(rampartId);
                
                if(rampart) {
                    rampart.setPublic(false);
                }
            });
            
            // 清空公开城墙列表
            rampartManager.toggle.publicRamparts = [];
            
            // 清空开关计划
            rampartManager.toggle.toggleSchedule = {};
            
            // 更新最后切换时间
            rampartManager.toggle.lastToggle = Game.time;
        }
    },
    
    // 可视化城墙状态
    visualizeRampartStatus: function(room) {
        const rampartManager = room.memory.rampartManager;
        const visual = room.visual;
        
        // 如果没有城墙，返回
        if(rampartManager.status.totalRamparts === 0) return;
        
        // 获取目标生命值
        const targetHits = rampartManager.maintenance.targetHits;
        
        // 可视化每个城墙的状态
        rampartManager.maintenance.priorityList.forEach(rampart => {
            const rampartObj = Game.getObjectById(rampart.id);
            if(!rampartObj) return;
            
            // 根据生命值确定颜色
            let color;
            if(rampart.hits < 10000) {
                color = '#ff0000'; // 红色：紧急
            } else if(rampart.hits < targetHits * 0.5) {
                color = '#ffaa00'; // 橙色：弱
            } else if(rampart.hits < targetHits) {
                color = '#ffff00'; // 黄色：一般
            } else {
                color = '#00ff00'; // 绿色：强
            }
            
            // 绘制城墙状态
            visual.rect(rampartObj.pos.x - 0.5, rampartObj.pos.y - 0.5, 1, 1, {
                fill: color,
                opacity: 0.2
            });
            
            // 显示生命值百分比
            const percent = Math.floor((rampart.hits / targetHits) * 100);
            visual.text(`${percent}%`, rampartObj.pos.x, rampartObj.pos.y, {
                color: 'white',
                font: 0.3,
                align: 'center'
            });
            
            // 如果是公开城墙，显示标记
            if(rampartObj.isPublic) {
                visual.circle(rampartObj.pos, {
                    radius: 0.3,
                    fill: '#00ffff',
                    opacity: 0.5
                });
            }
        });
        
        // 显示总体统计信息
        visual.text(`城墙: ${rampartManager.status.totalRamparts}`, 1, 10, {
            color: 'white',
            font: 0.7,
            align: 'left'
        });
        
        visual.text(`平均生命值: ${this.formatNumber(rampartManager.status.averageHits)}`, 1, 11, {
            color: 'white',
            font: 0.7,
            align: 'left'
        });
        
        visual.text(`目标生命值: ${this.formatNumber(targetHits)}`, 1, 12, {
            color: 'white',
            font: 0.7,
            align: 'left'
        });
        
        // 显示分类统计
        visual.text(`紧急: ${rampartManager.status.criticalCount}`, 1, 13, {
            color: '#ff0000',
            font: 0.7,
            align: 'left'
        });
        
        visual.text(`弱: ${rampartManager.status.weakCount}`, 1, 14, {
            color: '#ffaa00',
            font: 0.7,
            align: 'left'
        });
        
        visual.text(`强: ${rampartManager.status.strongCount}`, 1, 15, {
            color: '#00ff00',
            font: 0.7,
            align: 'left'
        });
        
        visual.text(`公开: ${rampartManager.status.publicCount}`, 1, 16, {
            color: '#00ffff',
            font: 0.7,
            align: 'left'
        });
    },
    
    // 获取目标生命值
    getTargetHits: function(room) {
        const level = room.controller.level;
        
        // 根据控制器等级设置目标生命值
        switch(level) {
            case 2: return 300000;
            case 3: return 1000000;
            case 4: return 3000000;
            case 5: return 10000000;
            case 6: return 30000000;
            case 7: return 100000000;
            case 8: return 300000000;
            default: return 10000;
        }
    },
    
    // 格式化数字
    formatNumber: function(num) {
        if(num >= 1000000) {
            return (num / 1000000).toFixed(1) + 'M';
        } else if(num >= 1000) {
            return (num / 1000).toFixed(1) + 'K';
        } else {
            return num;
        }
    },
    
    // 设置城墙公开状态
    setRampartPublic: function(room, rampartId, isPublic, duration) {
        // 检查房间是否有城墙管理系统
        if(!room.memory.rampartManager) {
            this.initializeMemory(room);
        }
        
        const rampartManager = room.memory.rampartManager;
        
        // 获取城墙
        const rampart = Game.getObjectById(rampartId);
        if(!rampart || rampart.structureType !== STRUCTURE_RAMPART) {
            return `ID ${rampartId} 不是有效的城墙`;
        }
        
        // 设置城墙状态
        rampart.setPublic(isPublic);
        
        // 如果指定了持续时间，添加到开关计划
        if(duration && duration > 0) {
            rampartManager.toggle.toggleSchedule[rampartId] = {
                toggleTime: Game.time + duration,
                setPublic: !isPublic
            };
            
            return `城墙 ${rampartId} 已设置为 ${isPublic ? '公开' : '私有'}，将在 ${duration} ticks 后恢复`;
        }
        
        return `城墙 ${rampartId} 已设置为 ${isPublic ? '公开' : '私有'}`;
    },
    
    // 设置所有城墙公开状态
    setAllRampartsPublic: function(room, isPublic, duration) {
        // 检查房间是否有城墙管理系统
        if(!room.memory.rampartManager) {
            this.initializeMemory(room);
        }
        
        const rampartManager = room.memory.rampartManager;
        
        // 获取所有城墙
        const ramparts = room.find(FIND_MY_STRUCTURES, {
            filter: s => s.structureType === STRUCTURE_RAMPART
        });
        
        if(ramparts.length === 0) {
            return `房间 ${room.name} 没有城墙`;
        }
        
        // 设置所有城墙状态
        ramparts.forEach(rampart => {
            rampart.setPublic(isPublic);
            
            // 如果指定了持续时间，添加到开关计划
            if(duration && duration > 0) {
                rampartManager.toggle.toggleSchedule[rampart.id] = {
                    toggleTime: Game.time + duration,
                    setPublic: !isPublic
                };
            }
        });
        
        // 更新最后切换时间
        rampartManager.toggle.lastToggle = Game.time;
        
        if(duration && duration > 0) {
            return `房间 ${room.name} 的所有城墙已设置为 ${isPublic ? '公开' : '私有'}，将在 ${duration} ticks 后恢复`;
        }
        
        return `房间 ${room.name} 的所有城墙已设置为 ${isPublic ? '公开' : '私有'}`;
    },
    
    // 获取城墙状态报告
    getRampartReport: function(room) {
        // 检查房间是否有城墙管理系统
        if(!room.memory.rampartManager) {
            this.initializeMemory(room);
        }
        
        const rampartManager = room.memory.rampartManager;
        
        // 如果没有城墙，返回简单报告
        if(rampartManager.status.totalRamparts === 0) {
            return `房间 ${room.name} 没有城墙`;
        }
        
        // 生成报告
        let report = `=== 房间 ${room.name} 城墙状态报告 ===\n`;
        report += `总数: ${rampartManager.status.totalRamparts}\n`;
        report += `平均生命值: ${this.formatNumber(rampartManager.status.averageHits)}\n`;
        report += `最小生命值: ${this.formatNumber(rampartManager.status.minHits)}\n`;
        report += `最大生命值: ${this.formatNumber(rampartManager.status.maxHits)}\n`;
        report += `目标生命值: ${this.formatNumber(rampartManager.maintenance.targetHits)}\n\n`;
        
        report += `紧急 (< 10K): ${rampartManager.status.criticalCount}\n`;
        report += `弱 (< 50%): ${rampartManager.status.weakCount}\n`;
        report += `强 (>= 100%): ${rampartManager.status.strongCount}\n`;
        report += `公开: ${rampartManager.status.publicCount}\n`;
        report += `私有: ${rampartManager.status.privateCount}\n\n`;
        
        // 添加优先级最高的5个城墙信息
        if(rampartManager.maintenance.priorityList.length > 0) {
            report += `优先维修城墙:\n`;
            
            const topPriority = rampartManager.maintenance.priorityList.slice(0, 5);
            topPriority.forEach((rampart, index) => {
                const percent = Math.floor((rampart.hits / rampartManager.maintenance.targetHits) * 100);
                report += `${index+1}. ID: ${rampart.id.substr(-4)}, 位置: (${rampart.pos.x},${rampart.pos.y}), 生命值: ${this.formatNumber(rampart.hits)} (${percent}%)\n`;
            });
        }
        
        return report;
    }
}; 