const utils = require('utils');

module.exports = {
    // 运行监控系统
    run: function() {
        try {
            // 遍历所有房间
            for(let roomName in Game.rooms) {
                const room = Game.rooms[roomName];
                
                // 检查是否是我们控制的房间
                if(!room || !room.controller || !room.controller.my) {
                    continue;
                }

                // 初始化监控数据
                if(!room.memory.monitor) {
                    this.initializeMonitor(room);
                }

                // 更新监控数据
                if(Game.time % 100 === 0) {
                    this.updateMonitorData(room);
                }

                // 检查异常
                this.checkAnomalies(room);

                // 生成报告
                if(Game.time % 1000 === 0) {
                    this.generateReport(room);
                }
            }
        } catch (error) {
            console.log('监控系统运行错误：', error);
        }
    },

    // 初始化监控数据
    initializeMonitor: function(room) {
        room.memory.monitor = {
            lastUpdate: Game.time,
            stats: {
                cpu: {
                    usage: [],
                    bucket: [],
                    lastReset: Game.time
                },
                memory: [],
                gcl: [],
                gpl: [],
                energy: [],
                minerals: [],
                creeps: [],
                structures: []
            },
            anomalies: [],
            thresholds: {
                cpu: {
                    warning: 0.7,    // CPU警告阈值（70%）
                    critical: 0.9,   // CPU严重阈值（90%）
                    bucketMin: 3000  // CPU bucket最小阈值
                },
                memory: 0.9,         // 内存使用率阈值
                energy: 0.2,         // 能量储备阈值
                creeps: 1.2,         // creep数量阈值（超过目标数量的120%）
                structures: 1.0      // 建筑数量阈值（达到限制的100%）
            }
        };
    },

    // 更新监控数据
    updateMonitorData: function(room) {
        const monitor = room.memory.monitor;
        
        // 确保monitor对象存在
        if (!monitor) {
            this.initializeMonitor(room);
            return;
        }

        // 确保stats对象存在
        if (!monitor.stats) {
            monitor.stats = {
                cpu: {
                    usage: [],
                    bucket: [],
                    lastReset: Game.time
                },
                memory: [],
                gcl: [],
                gpl: [],
                energy: [],
                minerals: [],
                creeps: [],
                structures: []
            };
        }

        // 确保cpu对象及其数组存在
        if (!monitor.stats.cpu) {
            monitor.stats.cpu = {
                usage: [],
                bucket: [],
                lastReset: Game.time
            };
        }
        if (!monitor.stats.cpu.usage) monitor.stats.cpu.usage = [];
        if (!monitor.stats.cpu.bucket) monitor.stats.cpu.bucket = [];

        // 确保其他数组存在
        if (!monitor.stats.memory) monitor.stats.memory = [];
        if (!monitor.stats.gcl) monitor.stats.gcl = [];
        if (!monitor.stats.gpl) monitor.stats.gpl = [];
        if (!monitor.stats.energy) monitor.stats.energy = [];
        if (!monitor.stats.minerals) monitor.stats.minerals = [];
        if (!monitor.stats.creeps) monitor.stats.creeps = [];
        if (!monitor.stats.structures) monitor.stats.structures = [];

        const storage = room.storage;
        const terminal = room.terminal;

        try {
            // 记录CPU使用率
            const cpuUsed = Game.cpu.getUsed();
            const cpuLimit = Game.cpu.limit;
            const cpuBucket = Game.cpu.bucket;
            
            // 计算实际CPU使用率（考虑可用CPU和bucket）
            const actualCpuUsage = this.calculateActualCpuUsage(cpuUsed, cpuLimit, cpuBucket);
            
            monitor.stats.cpu.usage.push(actualCpuUsage);
            monitor.stats.cpu.bucket.push(cpuBucket);
            
            // 限制数据长度
            if(monitor.stats.cpu.usage.length > 100) monitor.stats.cpu.usage.shift();
            if(monitor.stats.cpu.bucket.length > 100) monitor.stats.cpu.bucket.shift();
            
            // 每1000 ticks重置一次CPU统计
            if(Game.time - monitor.stats.cpu.lastReset >= 1000) {
                monitor.stats.cpu.usage = [];
                monitor.stats.cpu.bucket = [];
                monitor.stats.cpu.lastReset = Game.time;
            }

            // 记录内存使用率
            const memoryUsage = (RawMemory.get().length / 2097152); // 2MB 是默认内存限制
            monitor.stats.memory.push(memoryUsage);
            if(monitor.stats.memory.length > 100) monitor.stats.memory.shift();

            // 记录GCL和GPL
            monitor.stats.gcl.push(Game.gcl.level);
            if(monitor.stats.gcl.length > 100) monitor.stats.gcl.shift();

            monitor.stats.gpl.push(Game.gpl.level);
            if(monitor.stats.gpl.length > 100) monitor.stats.gpl.shift();

            // 记录能量状态
            let energyLevel = 0;
            if (storage) {
                const energyAmount = storage.store[RESOURCE_ENERGY] || 0;
                let storageCapacity = 0;
                
                // 尝试使用getCapacity方法，如果不存在则使用默认容量
                try {
                    storageCapacity = storage.store.getCapacity ? storage.store.getCapacity(RESOURCE_ENERGY) : 1000000;
                } catch (e) {
                    storageCapacity = 1000000; // 默认存储容量
                }
                
                energyLevel = storageCapacity > 0 ? energyAmount / storageCapacity : 0;
            }
            monitor.stats.energy.push(energyLevel);
            if(monitor.stats.energy.length > 100) monitor.stats.energy.shift();

            // 记录矿物状态
            let mineralLevel = 0;
            if (terminal) {
                let totalResources = 0;
                let totalCapacity = 0;
                
                // 尝试使用getCapacity方法，如果不存在则使用默认容量
                try {
                    totalCapacity = terminal.store.getCapacity ? terminal.store.getCapacity() : 50000;
                } catch (e) {
                    totalCapacity = 50000; // 默认终端容量
                }
                
                // 计算除能量外的所有资源
                for (let resourceType in terminal.store) {
                    if (resourceType !== RESOURCE_ENERGY) {
                        totalResources += terminal.store[resourceType] || 0;
                    }
                }
                
                // 计算比率
                mineralLevel = totalCapacity > 0 ? totalResources / totalCapacity : 0;
            }
            
            monitor.stats.minerals.push(mineralLevel);
            if(monitor.stats.minerals.length > 100) monitor.stats.minerals.shift();

            // 记录creep数量
            const creepCounts = _.countBy(Game.creeps, creep => 
                creep.room.name === room.name ? creep.memory.role : 'external'
            );
            delete creepCounts.external;
            
            // 使用spawner.js中的getTargetCounts获取目标数量
            try {
                // 获取SpawnManager实例
                const spawnManager = require('./spawner');
                const targetCounts = spawnManager.getTargetCounts(room);
                
                const totalCreeps = Object.values(creepCounts).reduce((sum, count) => sum + count, 0);
                const totalTarget = Object.values(targetCounts).reduce((sum, count) => sum + count, 0);
                const creepRatio = totalTarget > 0 ? totalCreeps / totalTarget : 1;
                
                monitor.stats.creeps.push(creepRatio);
                if(monitor.stats.creeps.length > 100) monitor.stats.creeps.shift();
                
                // 记录详细的Creep统计信息
                if(!monitor.creepStats) {
                    monitor.creepStats = {};
                }
                monitor.creepStats = {
                    counts: creepCounts,
                    targets: targetCounts,
                    totalCreeps: totalCreeps,
                    totalTarget: totalTarget,
                    ratio: creepRatio,
                    lastUpdate: Game.time
                };
            } catch (error) {
                console.log(`房间 ${room.name} 计算Creep比率时出错：${error.message}`);
                // 如果出错，使用默认值
                monitor.stats.creeps.push(1);
                if(monitor.stats.creeps.length > 100) monitor.stats.creeps.shift();
            }

            // 记录建筑数量，使用buildingPlanner中的优先级
            try {
                const buildingPlanner = require('./buildingPlanner');
                const STRUCTURE_PRIORITY = buildingPlanner.STRUCTURE_PRIORITY;

                const structures = room.find(FIND_MY_STRUCTURES);
                const structureCounts = _.countBy(structures, 'structureType');
                let totalRatio = 0;
                let validTypes = 0;
                let weightedRatio = 0;
                let totalWeight = 0;
                
                // 检查每种建筑类型的数量是否超过限制，并考虑优先级
                for(let type in structureCounts) {
                    // 使用buildingPlanner的getStructureLimit函数
                    const limit = buildingPlanner.getStructureLimit(type, room.controller.level);
                    if(limit > 0) {
                        const count = structureCounts[type] || 0;
                        const ratio = count / limit;
                        const priority = STRUCTURE_PRIORITY[type] || 15; // 未定义优先级的建筑放最后
                        const weight = 1 / priority; // 优先级越高，权重越大
                        
                        weightedRatio += ratio * weight;
                        totalWeight += weight;
                        validTypes++;

                        // 记录详细信息用于调试
                        if(ratio > 1) {
                            console.log(`房间 ${room.name} 建筑 ${type} 数量超限：${count}/${limit}`);
                        }
                    }
                }
                
                // 计算加权平均比率
                const structureRatio = validTypes > 0 ? weightedRatio / totalWeight : 0;
                monitor.stats.structures.push(structureRatio);
                if(monitor.stats.structures.length > 100) monitor.stats.structures.shift();

                // 记录建筑统计信息
                if(!monitor.buildingStats) {
                    monitor.buildingStats = {};
                }
                monitor.buildingStats = {
                    counts: structureCounts,
                    totalStructures: structures.length,
                    validTypes: validTypes,
                    averageRatio: structureRatio,
                    lastUpdate: Game.time
                };
            } catch (error) {
                console.log(`房间 ${room.name} 计算建筑比率时出错：${error.message}`);
                // 如果出错，使用默认值
                monitor.stats.structures.push(0);
                if(monitor.stats.structures.length > 100) monitor.stats.structures.shift();
            }

        } catch (error) {
            console.log(`房间 ${room.name} 更新监控数据时出错：${error.message}`);
            // 如果出错，重新初始化监控数据
            this.initializeMonitor(room);
        }

        monitor.lastUpdate = Game.time;
    },

    // 计算实际CPU使用率
    calculateActualCpuUsage: function(used, limit, bucket) {
        // 基础使用率
        let usage = used / limit;
        
        // 根据bucket状态调整使用率
        const bucketFactor = bucket / 10000; // bucket满时为1
        
        // 如果bucket较高（>5000），允许更高的CPU使用
        if(bucket > 5000) {
            usage *= 0.8; // 降低报警敏感度
        }
        // 如果bucket较低（<2000），提高CPU使用率警告
        else if(bucket < 2000) {
            usage *= 1.2; // 提高报警敏感度
        }
        
        return usage;
    },

    // 检查异常
    checkAnomalies: function(room) {
        const monitor = room.memory.monitor;
        const stats = monitor.stats;
        const thresholds = monitor.thresholds;

        // 清除旧的异常
        monitor.anomalies = [];

        // 检查CPU使用率
        if (stats.cpu && stats.cpu.usage && stats.cpu.bucket && stats.cpu.usage.length > 0) {
            const recentCpuUsage = stats.cpu.usage.slice(-10); // 只看最近10个数据点
            const avgCpu = recentCpuUsage.reduce((a, b) => a + b, 0) / recentCpuUsage.length;
            const maxCpu = Math.max(...recentCpuUsage);
            const minBucket = Math.min(...stats.cpu.bucket.slice(-10));
            
            if(maxCpu > thresholds.cpu.critical) {
                this.addAnomaly(room, 'CPU使用率严重过高', {
                    current: maxCpu,
                    threshold: thresholds.cpu.critical,
                    bucket: minBucket
                }, true);
            }
            else if(avgCpu > thresholds.cpu.warning && minBucket < thresholds.cpu.bucketMin) {
                this.addAnomaly(room, 'CPU使用率警告', {
                    current: avgCpu,
                    threshold: thresholds.cpu.warning,
                    bucket: minBucket
                }, true);
            }
        }

        if (stats.memory && stats.memory.length > 0) {
            const avgMemory = stats.memory.reduce((a, b) => a + b, 0) / stats.memory.length;
            if(avgMemory > thresholds.memory) {
                this.addAnomaly(room, '内存使用率过高', {
                    current: avgMemory,
                    threshold: thresholds.memory
                }, true);
            }
        }

        if (stats.energy && stats.energy.length > 0) {
            const avgEnergy = stats.energy.reduce((a, b) => a + b, 0) / stats.energy.length;
            if(avgEnergy < thresholds.energy) {
                this.addAnomaly(room, '能量储备不足', {
                    current: avgEnergy,
                    threshold: thresholds.energy
                }, true);
            }
        }

        if (stats.creeps && stats.creeps.length > 0) {
            const avgCreeps = stats.creeps.reduce((a, b) => a + b, 0) / stats.creeps.length;
            if(avgCreeps > thresholds.creeps) {
                this.addAnomaly(room, 'Creep数量过多', {
                    current: avgCreeps,
                    threshold: thresholds.creeps,
                    details: '当前Creep数量超过目标数量的120%'
                }, true);
            }
        }

        if (stats.structures && stats.structures.length > 0) {
            const avgStructures = stats.structures.reduce((a, b) => a + b, 0) / stats.structures.length;
            if(avgStructures > thresholds.structures) {
                this.addAnomaly(room, '建筑数量过多', {
                    current: avgStructures,
                    threshold: thresholds.structures,
                    details: '某些类型的建筑数量已达到控制器等级限制'
                }, true);
            }
        }
    },

    // 添加异常
    addAnomaly: function(room, type, data, suppressLog = false) {
        const monitor = room.memory.monitor;
        
        // 检查是否已存在相同类型的异常
        const existingAnomaly = monitor.anomalies.find(a => a.type === type);
        if(existingAnomaly) {
            // 如果数据没有变化，不更新时间戳
            if(JSON.stringify(existingAnomaly.data) === JSON.stringify(data)) {
                return;
            }
            existingAnomaly.data = data;
            existingAnomaly.time = Game.time;
        } else {
            monitor.anomalies.push({
                type: type,
                data: data,
                time: Game.time,
                firstDetected: Game.time
            });
            if(!suppressLog) {
                console.log(`房间 ${room.name} 发现新异常：${type}`);
            }
        }
    },

    // 生成报告
    generateReport: function(room) {
        const monitor = room.memory.monitor;
        const stats = monitor.stats;

        // 添加数据存在性检查
        if (!stats.cpu || !stats.cpu.usage || !stats.cpu.bucket || stats.cpu.usage.length === 0) {
            return; // 如果数据还未初始化，跳过报告生成
        }

        // 计算CPU统计数据
        const cpuStats = {
            avg: stats.cpu.usage.reduce((a, b) => a + b, 0) / stats.cpu.usage.length,
            max: Math.max(...stats.cpu.usage),
            min: Math.min(...stats.cpu.usage),
            bucket: {
                current: Game.cpu.bucket,
                avg: stats.cpu.bucket.reduce((a, b) => a + b, 0) / stats.cpu.bucket.length
            }
        };

        // 计算统计数据（添加数据存在性检查）
        const report = {
            cpu: cpuStats,
            memory: stats.memory && stats.memory.length > 0 ? {
                avg: stats.memory.reduce((a, b) => a + b, 0) / stats.memory.length,
                max: Math.max(...stats.memory),
                min: Math.min(...stats.memory)
            } : null,
            energy: stats.energy && stats.energy.length > 0 ? {
                avg: stats.energy.reduce((a, b) => a + b, 0) / stats.energy.length,
                max: Math.max(...stats.energy),
                min: Math.min(...stats.energy)
            } : null,
            creeps: stats.creeps && stats.creeps.length > 0 ? {
                avg: stats.creeps.reduce((a, b) => a + b, 0) / stats.creeps.length,
                max: Math.max(...stats.creeps),
                min: Math.min(...stats.creeps)
            } : null,
            structures: stats.structures && stats.structures.length > 0 ? {
                avg: stats.structures.reduce((a, b) => a + b, 0) / stats.structures.length,
                max: Math.max(...stats.structures),
                min: Math.min(...stats.structures)
            } : null,
            anomalies: monitor.anomalies,
            lastUpdate: monitor.lastUpdate
        };

        // 保存报告
        room.memory.monitor.report = report;

        // 输出报告（添加数据存在性检查）
        console.log(`房间 ${room.name} 监控报告：`);
        console.log(`CPU状态：
            平均使用率：${(cpuStats.avg * 100).toFixed(2)}%
            最大使用率：${(cpuStats.max * 100).toFixed(2)}%
            最小使用率：${(cpuStats.min * 100).toFixed(2)}%
            当前Bucket：${cpuStats.bucket.current}
            平均Bucket：${cpuStats.bucket.avg.toFixed(0)}`);
        
        if (report.memory) {
            console.log(`内存使用率：${(report.memory.avg * 100).toFixed(2)}%`);
        }
        if (report.energy) {
            console.log(`能量储备：${(report.energy.avg * 100).toFixed(2)}%`);
        }
        if (report.creeps) {
            console.log(`Creep数量比率：${(report.creeps.avg * 100).toFixed(2)}%`);
        }
        if (report.structures) {
            console.log(`建筑数量比率：${(report.structures.avg * 100).toFixed(2)}%`);
        }
        console.log(`异常数量：${report.anomalies.length}`);
    },

    // 获取监控统计信息
    getMonitorStats: function(room) {
        return room.memory.monitor.report || null;
    },

    // 获取异常列表
    getAnomalies: function(room) {
        return room.memory.monitor.anomalies || [];
    },

    // 清除异常
    clearAnomaly: function(room, type) {
        const monitor = room.memory.monitor;
        monitor.anomalies = monitor.anomalies.filter(a => a.type !== type);
    }
};