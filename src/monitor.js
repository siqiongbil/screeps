module.exports = {
    // 运行监控系统
    run: function(room) {
        try {
            // 检查房间是否有效
            if(!room) {
                return;
            }
            
            // 检查是否是我们控制的房间
            if(!room.controller || !room.controller.my) {
                return;
            }

            // 检查房间内存是否存在
            if(!room.memory) {
                return;
            }

            // 初始化监控数据
            if(!room.memory.monitor) {
                this.initializeMonitor(room);
            }

            // 更新监控数据 - 减少更新频率
            if(Game.time % 20 === 0) {
                this.updateMonitorData(room);
            }

            // 检查异常 - 减少检查频率
            if(Game.time % 50 === 0) {
                this.checkAnomalies(room);
            }

            // 生成报告（每200个tick生成一次）- 减少生成频率
            if(Game.time % 200 === 0) {
                this.generateReport(room);
            }
        } catch(error) {
            // 减少错误日志输出频率
            if(Game.time % 100 === 0) {
                console.log(`监控系统错误 (${room ? room.name : 'unknown'}): ${error}`);
            }
        }
    },

    // 初始化监控数据
    initializeMonitor: function(room) {
        room.memory.monitor = {
            lastUpdate: Game.time,
            structures: {
                total: 0,
                damaged: 0,
                critical: 0
            },
            energy: {
                available: 0,
                capacity: 0,
                sources: {}
            },
            creeps: {
                total: 0,
                byRole: {}
            },
            roads: {
                total: 0,
                damaged: 0,
                avgHealth: 100
            },
            resourceManagement: {
                efficiency: 0,
                distribution: {}
            },
            energyDistribution: {
                status: 'normal',
                efficiency: 0,
                creepRatios: {}
            },
            anomalies: [],
            history: {
                energy: [],
                creeps: [],
                efficiency: []
            }
        };
    },

    // 更新监控数据
    updateMonitorData: function(room) {
        try {
            const monitor = room.memory.monitor;
            
            // 更新时间戳
            monitor.lastUpdate = Game.time;
            
            // 更新结构状态
            this.updateStructureStatus(room);
            
            // 更新能源状态
            this.updateEnergyStatus(room);
            
            // 更新creep状态
            this.updateCreepStatus(room);
            
            // 更新道路状态
            this.updateRoadStatus(room);
            
            // 更新资源管理状态
            this.updateResourceManagementStatus(room);
            
            // 更新能源分配状态
            this.updateEnergyDistributionStatus(room);
            
            // 更新历史数据
            this.updateHistoryData(room);
        } catch(error) {
            console.log(`更新监控数据错误 (${room.name}): ${error}`);
        }
    },

    // 更新结构状态
    updateStructureStatus: function(room) {
        try {
            const monitor = room.memory.monitor;
            
            // 检查结构状态是否存在
            if(!room.memory.structures) {
                monitor.structures = {
                    total: 0,
                    damaged: 0,
                    critical: 0
                };
                return;
            }
            
            // 从结构状态获取数据
            const structures = room.memory.structures;
            
            monitor.structures = {
                total: structures.total || 0,
                damaged: structures.damaged || 0,
                critical: structures.critical || 0
            };
        } catch(error) {
            console.log(`更新结构状态错误 (${room.name}): ${error}`);
        }
    },

    // 更新能源状态
    updateEnergyStatus: function(room) {
        try {
            const monitor = room.memory.monitor;
            
            // 检查能源状态是否存在
            if(!room.memory.energy) {
                monitor.energy = {
                    available: 0,
                    capacity: 0,
                    sources: {}
                };
                return;
            }
            
            // 从能源状态获取数据
            const energy = room.memory.energy;
            
            monitor.energy = {
                available: energy.available || 0,
                capacity: energy.capacity || 0,
                sources: energy.sources || {}
            };
        } catch(error) {
            console.log(`更新能源状态错误 (${room.name}): ${error}`);
        }
    },

    // 更新creep状态
    updateCreepStatus: function(room) {
        try {
            const monitor = room.memory.monitor;
            
            // 检查creep状态是否存在
            if(!room.memory.creeps) {
                monitor.creeps = {
                    total: 0,
                    byRole: {}
                };
                return;
            }
            
            // 从creep状态获取数据
            const creeps = room.memory.creeps;
            
            monitor.creeps = {
                total: creeps.total || 0,
                byRole: creeps.byRole || {}
            };
        } catch(error) {
            console.log(`更新creep状态错误 (${room.name}): ${error}`);
        }
    },

    // 更新道路状态
    updateRoadStatus: function(room) {
        try {
            const monitor = room.memory.monitor;
            
            // 检查道路状态是否存在
            if(!room.memory.roads) {
                monitor.roads = {
                    total: 0,
                    damaged: 0,
                    avgHealth: 100
                };
                return;
            }
            
            // 从道路状态获取数据
            const roads = room.memory.roads;
            
            monitor.roads = {
                total: roads.total || 0,
                damaged: roads.damaged || 0,
                avgHealth: roads.avgHealth || 100
            };
        } catch(error) {
            console.log(`更新道路状态错误 (${room.name}): ${error}`);
        }
    },

    // 更新资源管理状态
    updateResourceManagementStatus: function(room) {
        try {
            const monitor = room.memory.monitor;
            
            // 检查资源管理系统是否存在
            if(!room.memory.resources) {
                monitor.resourceManagement = {
                    efficiency: 0,
                    distribution: {}
                };
                return;
            }
            
            // 从资源管理系统获取数据
            const resources = room.memory.resources;
            
            monitor.resourceManagement = {
                efficiency: resources.efficiency || 0,
                distribution: resources.distribution || {},
                status: resources.status || {}
            };
        } catch(error) {
            console.log(`更新资源管理状态错误 (${room.name}): ${error}`);
        }
    },

    // 更新能源分配状态
    updateEnergyDistributionStatus: function(room) {
        try {
            const monitor = room.memory.monitor;
            
            // 检查能源分配系统是否存在
            if(!room.memory.energyDistributor) {
                monitor.energyDistribution = {
                    status: 'normal',
                    efficiency: 0,
                    creepRatios: {}
                };
                return;
            }
            
            // 从能源分配系统获取数据
            const distributor = room.memory.energyDistributor;
            
            monitor.energyDistribution = {
                status: distributor.status.level || 'normal',
                efficiency: distributor.collection.efficiency || 0,
                creepRatios: distributor.creepRatios || {}
            };
        } catch(error) {
            console.log(`更新能源分配状态错误 (${room.name}): ${error}`);
        }
    },

    // 检查异常
    checkAnomalies: function(room) {
        try {
            // 检查房间是否有效
            if(!room || !room.memory) {
                console.log(`检查异常错误: 房间对象无效或房间内存不存在`);
                return;
            }
            
            const monitor = room.memory.monitor;
            
            // 确保monitor对象存在
            if (!monitor) {
                this.initializeMonitor(room);
                return;
            }
            
            // 使用let而不是const，避免引用可能会被修改的对象
            let stats = monitor.stats;
            let thresholds = monitor.thresholds;

            // 确保异常数组存在
            if (!monitor.anomalies) {
                monitor.anomalies = [];
            }

            // 检查stats和thresholds是否存在
            if (!stats || !thresholds) {
                return;
            }

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
                    this.addAnomaly(room, '能源水平过低', {
                        current: avgEnergy,
                        threshold: thresholds.energy
                    }, true);
                }
            }

            if (stats.creeps && stats.creeps.length > 0) {
                const avgCreeps = stats.creeps.reduce((a, b) => a + b, 0) / stats.creeps.length;
                if(avgCreeps < 0.5) {
                    this.addAnomaly(room, 'Creep数量严重不足', {
                        current: avgCreeps,
                        threshold: 0.5
                    }, true);
                }
                else if(avgCreeps > thresholds.creeps) {
                    this.addAnomaly(room, 'Creep数量过多', {
                        current: avgCreeps,
                        threshold: thresholds.creeps
                    }, true);
                }
            }

            if (stats.structures && stats.structures.length > 0) {
                const avgStructures = stats.structures.reduce((a, b) => a + b, 0) / stats.structures.length;
                if(avgStructures > thresholds.structures) {
                    this.addAnomaly(room, '结构数量接近上限', {
                        current: avgStructures,
                        threshold: thresholds.structures
                    }, true);
                }
            }
        } catch(error) {
            console.log(`检查异常错误 (${room.name}): ${error}`);
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
                time: Game.time
            });
            if(!suppressLog) {
                console.log(`房间 ${room.name} 发现新异常：${type}`);
            }
        }
    },

    // 生成报告
    generateReport: function(room) {
        try {
            // 检查房间是否有效
            if(!room || !room.controller) {
                return;
            }
            
            const monitor = room.memory.monitor;
            
            // 检查 monitor 是否存在
            if(!monitor) {
                return;
            }
            
            const stats = monitor.stats;

            // 添加数据存在性检查
            if (!stats || !stats.cpu || !stats.cpu.usage || !stats.cpu.bucket || stats.cpu.usage.length === 0) {
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
            let report = {
                cpu: cpuStats,
                memory: stats.memory && stats.memory.length > 0 ? {
                    avg: stats.memory.reduce((a, b) => a + b, 0) / stats.memory.length
                } : null,
                energy: stats.energy && stats.energy.length > 0 ? {
                    avg: stats.energy.reduce((a, b) => a + b, 0) / stats.energy.length
                } : null,
                creeps: stats.creeps && stats.creeps.length > 0 ? {
                    avg: stats.creeps.reduce((a, b) => a + b, 0) / stats.creeps.length
                } : null,
                structures: stats.structures && stats.structures.length > 0 ? {
                    avg: stats.structures.reduce((a, b) => a + b, 0) / stats.structures.length
                } : null,
                anomalies: monitor.anomalies ? monitor.anomalies.length : 0,
                lastUpdate: monitor.lastUpdate
            };

            // 保存报告 - 简化报告内容
            room.memory.monitor.report = JSON.stringify(report);

            // 输出报告 - 减少日志输出
            console.log(`房间 ${room.name} 监控报告：CPU使用率: ${(cpuStats.avg * 100).toFixed(2)}%, Bucket: ${cpuStats.bucket.current}, 异常: ${monitor.anomalies ? monitor.anomalies.length : 0}`);
        } catch(error) {
            // 减少错误日志输出频率
            if(Game.time % 100 === 0) {
                console.log(`生成报告错误 (${room ? room.name : 'unknown'}): ${error}`);
            }
        }
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
    },

    // 更新历史数据
    updateHistoryData: function(room) {
        try {
            // 检查房间是否有效
            if(!room || !room.controller) {
                return;
            }
            
            const monitor = room.memory.monitor;
            
            // 确保历史数据结构存在
            if(!monitor.history) {
                monitor.history = {
                    energy: [],
                    creeps: [],
                    efficiency: []
                };
            }
            
            // 确保stats结构存在
            if(!monitor.stats) {
                monitor.stats = {
                    cpu: {
                        usage: [],
                        bucket: []
                    },
                    memory: [],
                    energy: [],
                    creeps: [],
                    structures: []
                };
            }
            
            // 更新CPU统计 - 使用let而不是直接修改monitor.stats.cpu
            if(!monitor.stats.cpu) {
                monitor.stats.cpu = { usage: [], bucket: [] };
            }
            monitor.stats.cpu.usage.push(Game.cpu.getUsed() / Game.cpu.limit);
            monitor.stats.cpu.bucket.push(Game.cpu.bucket);
            
            // 限制数组长度 - 减少历史数据保存量
            if(monitor.stats.cpu.usage.length > 50) monitor.stats.cpu.usage.shift();
            if(monitor.stats.cpu.bucket.length > 50) monitor.stats.cpu.bucket.shift();
            
            // 更新能源统计
            const energyAvailable = room.energyAvailable;
            const energyCapacity = room.energyCapacityAvailable;
            const energyRatio = energyCapacity > 0 ? energyAvailable / energyCapacity : 0;
            
            monitor.stats.energy.push(energyRatio);
            if(monitor.stats.energy.length > 50) monitor.stats.energy.shift();
            
            // 更新creep统计
            const creepsInRoom = _.filter(Game.creeps, creep => creep.room.name === room.name).length;
            const targetCreeps = this.getTargetCreepCount(room);
            const creepRatio = targetCreeps > 0 ? creepsInRoom / targetCreeps : 1;
            
            monitor.stats.creeps.push(creepRatio);
            if(monitor.stats.creeps.length > 50) monitor.stats.creeps.shift();
            
            // 更新结构统计 - 添加安全检查
            try {
                const structures = room.find(FIND_STRUCTURES).length;
                const maxStructures = CONTROLLER_STRUCTURES.spawn[room.controller.level] * 30; // 粗略估计
                const structureRatio = maxStructures > 0 ? structures / maxStructures : 0;
                
                monitor.stats.structures.push(structureRatio);
                if(monitor.stats.structures.length > 50) monitor.stats.structures.shift();
            } catch(structError) {
                // 减少错误日志输出
                monitor.stats.structures.push(0);
                if(monitor.stats.structures.length > 50) monitor.stats.structures.shift();
            }
            
            // 更新内存使用统计
            const memorySize = JSON.stringify(Memory).length;
            const memoryRatio = memorySize / (2 * 1024 * 1024); // 2MB限制
            
            monitor.stats.memory.push(memoryRatio);
            if(monitor.stats.memory.length > 50) monitor.stats.memory.shift();
            
            // 确保阈值存在
            if(!monitor.thresholds) {
                monitor.thresholds = {
                    cpu: {
                        warning: 0.8,
                        critical: 0.95,
                        bucketMin: 3000
                    },
                    memory: 0.8,
                    energy: 0.3,
                    creeps: 1.2,
                    structures: 0.9
                };
            }
            
            // 更新历史数据 - 减少历史数据保存频率
            if(Game.time % 10 === 0) {
                monitor.history.energy.push({
                    time: Game.time,
                    value: energyRatio
                });
                
                monitor.history.creeps.push({
                    time: Game.time,
                    value: creepRatio
                });
                
                // 计算效率
                const efficiency = (energyRatio + creepRatio) / 2;
                
                monitor.history.efficiency.push({
                    time: Game.time,
                    value: efficiency
                });
            }
            
            // 限制历史数据长度 - 减少历史数据保存量
            if(monitor.history.energy.length > 50) monitor.history.energy.shift();
            if(monitor.history.creeps.length > 50) monitor.history.creeps.shift();
            if(monitor.history.efficiency.length > 50) monitor.history.efficiency.shift();
        } catch(error) {
            // 减少错误日志输出频率
            if(Game.time % 100 === 0) {
                console.log(`更新历史数据错误 (${room.name}): ${error}`);
            }
        }
    },
    
    // 获取目标creep数量
    getTargetCreepCount: function(room) {
        // 基于控制器等级估算目标creep数量
        const rcl = room.controller.level;
        return Math.min(rcl * 3, 12); // 控制器等级 * 3，最多12个
    },

    // 记录异常
    recordAnomaly: function(room, category, message) {
        try {
            const monitor = room.memory.monitor;
            
            // 确保异常数组存在
            if(!monitor.anomalies) {
                monitor.anomalies = [];
            }
            
            // 检查是否已存在相同类别的异常
            const existingAnomaly = monitor.anomalies.find(a => a.type === category);
            
            if(existingAnomaly) {
                // 如果已存在相同类别的异常，更新消息和时间
                existingAnomaly.data = { message: message };
                existingAnomaly.time = Game.time;
            } else {
                // 否则添加新异常
                monitor.anomalies.push({
                    type: category,
                    data: { message: message },
                    time: Game.time
                });
                
                // 记录日志
                console.log(`[Monitor] 房间 ${room.name} 发现新异常：${category} - ${message}`);
            }
        } catch(error) {
            console.log(`记录异常错误 (${room.name}): ${error}`);
        }
    },
};