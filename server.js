class P2PMonitor {
    constructor() {
        this.isRunning = false;
        this.interval = null;
        this.initElements();
        this.bindEvents();
        this.checkServerStatus(); // Проверяем статус сервера при загрузке
    }

    initElements() {
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.status = document.getElementById('status');
        this.buyPrice = document.getElementById('buyPrice');
        this.sellPrice = document.getElementById('sellPrice');
        this.buyTime = document.getElementById('buyTime');
        this.sellTime = document.getElementById('sellTime');
        this.dataLog = document.getElementById('dataLog');
        this.minAmountInput = document.getElementById('minAmount');
        this.bankSelect = document.getElementById('bankSelect');
        this.loadAnalyticsBtn = document.getElementById('loadAnalytics');
        this.analyticsInfo = document.getElementById('analyticsInfo');
        this.analyticsChart = document.getElementById('analyticsChart');
        this.recommendations = document.getElementById('recommendations');
    }

    bindEvents() {
        this.startBtn.addEventListener('click', () => this.start());
        this.stopBtn.addEventListener('click', () => this.stop());
        this.loadAnalyticsBtn.addEventListener('click', () => this.loadAnalytics());
    }

    async fetchP2PData() {
        try {
            const minAmount = parseInt(this.minAmountInput.value) || 5000;
            const selectedBank = this.bankSelect.value;
            
            // Запрос к нашему серверу с параметрами
            const response = await fetch('http://localhost:3000/api/p2p-data', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    minAmount: minAmount,
                    bank: selectedBank
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || 'Ошибка получения данных');
            }

            const bankText = selectedBank ? this.getBankName(selectedBank) : 'все банки';
            this.addLog(`Данные получены от Bybit P2P (мин. ${minAmount} ₴, ${bankText})`, 'info');
            return {
                buyData: result.buyData,
                sellData: result.sellData
            };
            
        } catch (error) {
            console.error('Error fetching P2P data:', error);
            this.addLog(`Ошибка API: ${error.message}`, 'error');
            return null;
        }
    }

    getBankName(bankCode) {
        const bankNames = {
            'mono': 'Monobank',
            'privat': 'ПриватБанк',
            'oschadbank': 'Ощадбанк'
        };
        return bankNames[bankCode] || bankCode;
    }

    updatePrices(data) {
        console.log('Received data:', data); // Для отладки
        
        if (!data) {
            this.addLog('Нет данных от API', 'warning');
            return;
        }

        // Проверяем структуру данных Bybit
        if (!data.buyData || !data.sellData) {
            this.addLog('Неверная структура данных', 'warning');
            return;
        }

        // Для Bybit данные в result.items
        const buyAds = data.buyData.result?.items || [];
        const sellAds = data.sellData.result?.items || [];
        const currentTime = new Date().toLocaleTimeString();

        if (buyAds.length === 0 && sellAds.length === 0) {
            this.addLog('Нет объявлений', 'warning');
            return;
        }

        // Пробуем получить цены из Bybit структуры (берем 3-е объявление)
        let bestBuyPrice = 0;
        let bestSellPrice = 0;
        let buyerName = '';
        let sellerName = '';

        // Берем 3-е объявление (индекс 2), если есть, иначе первое
        if (buyAds.length > 2 && buyAds[2].price) {
            bestBuyPrice = parseFloat(buyAds[2].price);
            buyerName = buyAds[2].nickName || 'Неизвестно';
        } else if (buyAds.length > 0 && buyAds[0].price) {
            bestBuyPrice = parseFloat(buyAds[0].price);
            buyerName = buyAds[0].nickName || 'Неизвестно';
        }

        if (sellAds.length > 2 && sellAds[2].price) {
            bestSellPrice = parseFloat(sellAds[2].price);
            sellerName = sellAds[2].nickName || 'Неизвестно';
        } else if (sellAds.length > 0 && sellAds[0].price) {
            bestSellPrice = parseFloat(sellAds[0].price);
            sellerName = sellAds[0].nickName || 'Неизвестно';
        }

        if (bestBuyPrice > 0) {
            this.buyPrice.textContent = `${bestBuyPrice.toFixed(2)} ₴`;
            this.buyTime.textContent = currentTime;
        }

        if (bestSellPrice > 0) {
            this.sellPrice.textContent = `${bestSellPrice.toFixed(2)} ₴`;
            this.sellTime.textContent = currentTime;
        }

        // Добавляем в лог с указанием позиции и имен
        if (bestBuyPrice > 0 && bestSellPrice > 0) {
            const spread = ((bestSellPrice - bestBuyPrice) / bestBuyPrice * 100).toFixed(2);
            const buyPos = buyAds.length > 2 ? '3-е' : '1-е';
            const sellPos = sellAds.length > 2 ? '3-е' : '1-е';
            this.addLog(`Покупка: ${bestBuyPrice.toFixed(2)} ₴ (${buyPos}, ${buyerName}) | Продажа: ${bestSellPrice.toFixed(2)} ₴ (${sellPos}, ${sellerName}) | Спред: ${spread}%`);
        } else if (bestBuyPrice > 0) {
            const buyPos = buyAds.length > 2 ? '3-е' : '1-е';
            this.addLog(`Покупка: ${bestBuyPrice.toFixed(2)} ₴ (${buyPos}, ${buyerName})`);
        } else if (bestSellPrice > 0) {
            const sellPos = sellAds.length > 2 ? '3-е' : '1-е';
            this.addLog(`Продажа: ${bestSellPrice.toFixed(2)} ₴ (${sellPos}, ${sellerName})`);
        } else {
            this.addLog('Не удалось получить цены', 'warning');
        }
    }

    addLog(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        
        logEntry.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="price-data">${message}</span>
        `;

        this.dataLog.insertBefore(logEntry, this.dataLog.firstChild);

        // Ограничиваем количество записей в логе
        if (this.dataLog.children.length > 100) {
            this.dataLog.removeChild(this.dataLog.lastChild);
        }
    }

    async start() {
        if (this.isRunning) return;

        try {
            const minAmount = parseInt(this.minAmountInput.value) || 5000;
            const selectedBank = this.bankSelect.value;

            // Запускаем серверный мониторинг
            const response = await fetch('/api/monitoring/start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    minAmount: minAmount,
                    bank: selectedBank
                })
            });

            const result = await response.json();
            
            if (result.success) {
                this.isRunning = true;
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.status.textContent = 'Серверный мониторинг активен';
                this.addLog('Серверный мониторинг 24/7 запущен');
                
                // Запускаем клиентское обновление данных
                this.startClientUpdates();
            } else {
                this.addLog(`Ошибка запуска: ${result.message}`, 'error');
            }

        } catch (error) {
            console.error('Error starting monitoring:', error);
            this.addLog(`Ошибка запуска: ${error.message}`, 'error');
        }
    }

    async stop() {
        if (!this.isRunning) return;

        try {
            // Останавливаем серверный мониторинг
            const response = await fetch('/api/monitoring/stop', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const result = await response.json();
            
            if (result.success) {
                this.isRunning = false;
                this.startBtn.disabled = false;
                this.stopBtn.disabled = true;
                this.status.textContent = 'Мониторинг остановлен';
                this.addLog('Серверный мониторинг остановлен');
                
                // Останавливаем клиентское обновление
                this.stopClientUpdates();
            }

        } catch (error) {
            console.error('Error stopping monitoring:', error);
            this.addLog(`Ошибка остановки: ${error.message}`, 'error');
        }
    }

    async checkServerStatus() {
        try {
            const response = await fetch('/api/monitoring/status');
            const data = await response.json();
            
            if (data.success && data.isActive) {
                // Сервер уже мониторит
                this.isRunning = true;
                this.startBtn.disabled = true;
                this.stopBtn.disabled = false;
                this.status.textContent = 'Серверный мониторинг активен';
                this.addLog(`Мониторинг уже запущен (собрано ${data.recordsCount} записей)`);
                
                // Запускаем клиентское обновление
                this.startClientUpdates();
            } else {
                this.status.textContent = 'Готов к запуску';
            }
            
        } catch (error) {
            console.error('Error checking server status:', error);
            this.status.textContent = 'Ошибка подключения к серверу';
        }
    }

    startClientUpdates() {
        // Запускаем периодическое обновление интерфейса каждые 30 секунд
        this.interval = setInterval(() => {
            this.updateInterfaceFromServer();
        }, 30000);
        
        // Первое обновление сразу
        this.updateInterfaceFromServer();
    }

    stopClientUpdates() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }

    async updateInterfaceFromServer() {
        try {
            // Получаем последние данные от сервера
            const response = await fetch('/api/analytics');
            const data = await response.json();
            
            if (data.success && data.latestData && data.latestData.length > 0) {
                const latest = data.latestData[0]; // Самая последняя запись
                
                // Обновляем интерфейс
                this.buyPrice.textContent = `${latest.buyPrice.toFixed(2)} ₴`;
                this.sellPrice.textContent = `${latest.sellPrice.toFixed(2)} ₴`;
                this.buyTime.textContent = latest.time;
                this.sellTime.textContent = latest.time;
                
                // Добавляем в лог
                this.addLog(`Покупка: ${latest.buyPrice.toFixed(2)} ₴ (${latest.buyerName}) | Продажа: ${latest.sellPrice.toFixed(2)} ₴ (${latest.sellerName}) | Спред: ${latest.spreadPercent.toFixed(2)}%`);
            }
            
        } catch (error) {
            console.error('Error updating from server:', error);
        }
    }

    async loadAnalytics() {
        try {
            this.analyticsInfo.textContent = 'Загрузка аналитики...';
            
            const response = await fetch('/api/analytics');
            const data = await response.json();
            
            if (!data.success) {
                throw new Error(data.error || 'Ошибка загрузки аналитики');
            }

            this.displayAnalytics(data);
            
        } catch (error) {
            console.error('Error loading analytics:', error);
            this.analyticsInfo.textContent = `Ошибка: ${error.message}`;
        }
    }

    displayAnalytics(data) {
        this.analyticsInfo.textContent = `Собрано ${data.totalRecords} записей данных`;
        
        if (data.totalRecords === 0) {
            this.analyticsChart.innerHTML = '<p>Нет данных для отображения. Запустите мониторинг для сбора данных.</p>';
            this.recommendations.innerHTML = '';
            return;
        }

        // Отображаем график по часам
        this.renderHourlyChart(data.hourlyAnalytics);
        
        // Генерируем рекомендации
        this.generateRecommendations(data.hourlyAnalytics);
    }

    renderHourlyChart(hourlyData) {
        let chartHTML = '<h3>Средние цены по часам</h3>';
        
        hourlyData.forEach(hour => {
            const buyPrice = hour.avgBuyPrice.toFixed(2);
            const sellPrice = hour.avgSellPrice.toFixed(2);
            const spread = hour.avgSpread.toFixed(2);
            const count = hour.count;
            
            chartHTML += `
                <div class="hour-bar">
                    <div class="hour-label">${hour.hour}:00</div>
                    <div class="price-bar"></div>
                    <div class="price-info">
                        Покупка: ${buyPrice}₴ | Продажа: ${sellPrice}₴ | Спред: ${spread}% | Записей: ${count}
                    </div>
                </div>
            `;
        });
        
        this.analyticsChart.innerHTML = chartHTML;
    }

    generateRecommendations(hourlyData) {
        if (hourlyData.length < 3) {
            this.recommendations.innerHTML = '<h3>Рекомендации</h3><p>Недостаточно данных для анализа. Собирайте данные дольше.</p>';
            return;
        }

        // Анализируем закономерности
        const analysis = this.analyzePatterns(hourlyData);
        
        let recommendationsHTML = `
            <h3>🎯 Анализ закономерностей торговли</h3>
            
            <div class="analysis-section">
                <h4>📊 Статистика по времени:</h4>
                <div class="recommendation-item">
                    <strong>💰 Самые дешевые часы для покупки:</strong> 
                    ${analysis.cheapestHours.map(h => `${h.hour}:00 (${h.avgBuyPrice.toFixed(2)}₴)`).join(', ')}
                </div>
                
                <div class="recommendation-item">
                    <strong>💸 Самые дорогие часы для продажи:</strong> 
                    ${analysis.expensiveHours.map(h => `${h.hour}:00 (${h.avgSellPrice.toFixed(2)}₴)`).join(', ')}
                </div>
                
                <div class="recommendation-item">
                    <strong>📈 Часы с максимальным спредом:</strong> 
                    ${analysis.highSpreadHours.map(h => `${h.hour}:00 (${h.avgSpread.toFixed(2)}%)`).join(', ')}
                </div>
            </div>

            <div class="analysis-section">
                <h4>🔍 Проверка логики "утром дешево - вечером дорого":</h4>
                ${this.generateTimeLogicAnalysis(hourlyData)}
            </div>

            <div class="analysis-section">
                <h4>💡 Топ прибыльных стратегий:</h4>
                ${this.generateProfitableStrategies(hourlyData)}
            </div>

            <div class="analysis-section">
                <h4>⚠️ Выводы и рекомендации:</h4>
                ${this.generateConclusions(analysis, hourlyData)}
            </div>
        `;

        this.recommendations.innerHTML = recommendationsHTML;
    }

    analyzePatterns(hourlyData) {
        // Находим топ-3 самых дешевых часов для покупки
        const cheapestHours = [...hourlyData]
            .filter(h => h.count >= 2)
            .sort((a, b) => a.avgBuyPrice - b.avgBuyPrice)
            .slice(0, 3);

        // Находим топ-3 самых дорогих часов для продажи  
        const expensiveHours = [...hourlyData]
            .filter(h => h.count >= 2)
            .sort((a, b) => b.avgSellPrice - a.avgSellPrice)
            .slice(0, 3);

        // Находим часы с максимальным спредом
        const highSpreadHours = [...hourlyData]
            .filter(h => h.count >= 2)
            .sort((a, b) => b.avgSpread - a.avgSpread)
            .slice(0, 3);

        return { cheapestHours, expensiveHours, highSpreadHours };
    }

    generateTimeLogicAnalysis(hourlyData) {
        const morningHours = hourlyData.filter(h => h.hour >= 6 && h.hour <= 11 && h.count >= 2);
        const afternoonHours = hourlyData.filter(h => h.hour >= 12 && h.hour <= 17 && h.count >= 2);
        const eveningHours = hourlyData.filter(h => h.hour >= 18 && h.hour <= 23 && h.count >= 2);
        const nightHours = hourlyData.filter(h => (h.hour >= 0 && h.hour <= 5) && h.count >= 2);

        if (morningHours.length === 0 || eveningHours.length === 0) {
            return '<p>Недостаточно данных для анализа по времени суток.</p>';
        }

        const avgMorningBuy = morningHours.reduce((sum, h) => sum + h.avgBuyPrice, 0) / morningHours.length;
        const avgEveningBuy = eveningHours.reduce((sum, h) => sum + h.avgBuyPrice, 0) / eveningHours.length;
        const avgMorningSell = morningHours.reduce((sum, h) => sum + h.avgSellPrice, 0) / morningHours.length;
        const avgEveningSell = eveningHours.reduce((sum, h) => sum + h.avgSellPrice, 0) / eveningHours.length;

        const morningCheaper = avgMorningBuy < avgEveningBuy;
        const eveningMoreExpensive = avgEveningSell > avgMorningSell;
        
        const buyDifference = Math.abs(avgMorningBuy - avgEveningBuy);
        const sellDifference = Math.abs(avgEveningSell - avgMorningSell);

        let analysis = `
            <div class="logic-analysis">
                <p><strong>Утром (6:00-11:00):</strong> Средняя покупка ${avgMorningBuy.toFixed(2)}₴, продажа ${avgMorningSell.toFixed(2)}₴</p>
                <p><strong>Вечером (18:00-23:00):</strong> Средняя покупка ${avgEveningBuy.toFixed(2)}₴, продажа ${avgEveningSell.toFixed(2)}₴</p>
                
                <div class="logic-result ${morningCheaper ? 'positive' : 'negative'}">
                    ${morningCheaper ? '✅' : '❌'} Утром покупать ${morningCheaper ? 'ВЫГОДНЕЕ' : 'ДОРОЖЕ'} на ${buyDifference.toFixed(2)}₴
                </div>
                
                <div class="logic-result ${eveningMoreExpensive ? 'positive' : 'negative'}">
                    ${eveningMoreExpensive ? '✅' : '❌'} Вечером продавать ${eveningMoreExpensive ? 'ВЫГОДНЕЕ' : 'ДЕШЕВЛЕ'} на ${sellDifference.toFixed(2)}₴
                </div>
            </div>
        `;

        return analysis;
    }

    generateProfitableStrategies(hourlyData) {
        const strategies = [];
        
        // Проверяем все возможные комбинации часов
        for (let buyHour of hourlyData) {
            if (buyHour.count < 2) continue;
            
            for (let sellHour of hourlyData) {
                if (sellHour.count < 2 || sellHour.hour === buyHour.hour) continue;
                
                const profit = sellHour.avgSellPrice - buyHour.avgBuyPrice;
                const profitPercent = (profit / buyHour.avgBuyPrice) * 100;
                
                if (profit > 0) {
                    strategies.push({
                        buyHour: buyHour.hour,
                        sellHour: sellHour.hour,
                        profit: profit,
                        profitPercent: profitPercent,
                        buyPrice: buyHour.avgBuyPrice,
                        sellPrice: sellHour.avgSellPrice
                    });
                }
            }
        }

        // Сортируем по прибыльности
        strategies.sort((a, b) => b.profitPercent - a.profitPercent);
        
        if (strategies.length === 0) {
            return '<p>Прибыльных стратегий не найдено.</p>';
        }

        let strategiesHTML = '<div class="strategies-list">';
        
        strategies.slice(0, 5).forEach((strategy, index) => {
            strategiesHTML += `
                <div class="strategy-item ${index === 0 ? 'best-strategy' : ''}">
                    <strong>${index + 1}. Покупка в ${strategy.buyHour}:00 → Продажа в ${strategy.sellHour}:00</strong>
                    <br>Прибыль: ${strategy.profit.toFixed(2)}₴ (${strategy.profitPercent.toFixed(2)}%)
                    <br>Цены: ${strategy.buyPrice.toFixed(2)}₴ → ${strategy.sellPrice.toFixed(2)}₴
                </div>
            `;
        });
        
        strategiesHTML += '</div>';
        return strategiesHTML;
    }

    generateConclusions(analysis, hourlyData) {
        let conclusions = '';
        
        if (hourlyData.length < 12) {
            conclusions += '<p class="warning">⚠️ Мало данных для надежных выводов. Собирайте данные минимум сутки.</p>';
        }

        const totalRecords = hourlyData.reduce((sum, h) => sum + h.count, 0);
        
        if (totalRecords < 50) {
            conclusions += '<p class="warning">⚠️ Недостаточно записей для статистической значимости.</p>';
        }

        // Проверяем стабильность цен
        const allBuyPrices = hourlyData.map(h => h.avgBuyPrice);
        const buyPriceRange = Math.max(...allBuyPrices) - Math.min(...allBuyPrices);
        
        if (buyPriceRange < 0.5) {
            conclusions += '<p class="info">📊 Цены стабильны, разброс менее 0.5₴ - арбитраж сложен.</p>';
        } else {
            conclusions += '<p class="success">💰 Есть разброс цен ${buyPriceRange.toFixed(2)}₴ - возможен арбитраж!</p>';
        }

        return conclusions || '<p class="success">✅ Система работает нормально, продолжайте сбор данных.</p>';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new P2PMonitor();
});