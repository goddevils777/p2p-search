const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Файл для сохранения данных
const DATA_FILE = path.join(__dirname, 'price_history.json');

// Хранилище данных в памяти
let priceHistory = [];
let isMonitoringActive = false;
let monitoringInterval = null;
let currentMonitoringSettings = {
    minAmount: 5000,
    bank: ''
};

// Функции для работы с файлами
function loadHistoryFromFile() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            priceHistory = JSON.parse(data);
            console.log(`📁 Загружено ${priceHistory.length} записей из файла`);
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки данных:', error);
        priceHistory = [];
    }
}

function saveHistoryToFile() {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(priceHistory, null, 2));
        console.log(`💾 Сохранено ${priceHistory.length} записей в файл`);
    } catch (error) {
        console.error('❌ Ошибка сохранения данных:', error);
    }
}

// Загружаем данные при старте
loadHistoryFromFile();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('.'));

// Функция сохранения данных в историю
function saveToHistory(buyData, sellData, minAmount, selectedBank) {
    try {
        const now = new Date();
        const buyAds = buyData.result?.items || [];
        const sellAds = sellData.result?.items || [];

        let buyPrice = 0;
        let sellPrice = 0;
        let buyerName = '';
        let sellerName = '';

        // Берем 3-е объявление (индекс 2), если есть, иначе первое
        if (buyAds.length > 2 && buyAds[2].price) {
            buyPrice = parseFloat(buyAds[2].price);
            buyerName = buyAds[2].nickName || 'Неизвестно';
        } else if (buyAds.length > 0 && buyAds[0].price) {
            buyPrice = parseFloat(buyAds[0].price);
            buyerName = buyAds[0].nickName || 'Неизвестно';
        }

        if (sellAds.length > 2 && sellAds[2].price) {
            sellPrice = parseFloat(sellAds[2].price);
            sellerName = sellAds[2].nickName || 'Неизвестно';
        } else if (sellAds.length > 0 && sellAds[0].price) {
            sellPrice = parseFloat(sellAds[0].price);
            sellerName = sellAds[0].nickName || 'Неизвестно';
        }

        // Сохраняем только если есть цены
        if (buyPrice > 0 || sellPrice > 0) {
            const spread = sellPrice - buyPrice;
            const spreadPercent = buyPrice > 0 ? ((spread / buyPrice) * 100) : 0;

            const record = {
                timestamp: now.toISOString(),
                date: now.toDateString(),
                time: now.toTimeString().split(' ')[0],
                hour: now.getHours(),
                dayOfWeek: now.toLocaleDateString('ru', { weekday: 'long' }),
                buyPrice: buyPrice,
                sellPrice: sellPrice,
                spread: spread,
                spreadPercent: spreadPercent,
                buyerName: buyerName,
                sellerName: sellerName,
                minAmount: minAmount,
                selectedBank: selectedBank || 'все'
            };

            priceHistory.push(record);

            // Ограничиваем историю до 5000 записей (примерно неделя данных)
            if (priceHistory.length > 5000) {
                priceHistory.shift();
            }

            // Автосохранение каждые 10 записей
            if (priceHistory.length % 10 === 0) {
                saveHistoryToFile();
            }

            console.log(`💾 Данные сохранены: ${record.time} | Покупка: ${buyPrice.toFixed(2)} ₴ | Продажа: ${sellPrice.toFixed(2)} ₴`);
        }
    } catch (error) {
        console.error('❌ Ошибка сохранения данных:', error);
    }
}

// Функции серверного мониторинга
function startServerMonitoring() {
    if (isMonitoringActive) return;
    
    isMonitoringActive = true;
    console.log('🚀 Запущен серверный мониторинг 24/7');
    
    // Первый запрос сразу
    performMonitoringRequest();
    
    // Запускаем периодические запросы каждые 30 секунд
    monitoringInterval = setInterval(() => {
        performMonitoringRequest();
    }, 30000);
}

function stopServerMonitoring() {
    if (!isMonitoringActive) return;
    
    isMonitoringActive = false;
    
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
    }
    
    console.log('⏹️ Серверный мониторинг остановлен');
}

async function performMonitoringRequest() {
    try {
        console.log('🔄 Выполняется серверный мониторинг...');
        
        const { minAmount, bank } = currentMonitoringSettings;
        const paymentFilter = [];
        
        // Запрос на покупку USDT
        const buyResponse = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                userId: "",
                tokenId: "USDT",
                currencyId: "UAH",
                payment: paymentFilter,
                side: "1",
                size: "20",
                page: "1",
                amount: minAmount.toString(),
                authMaker: false,
                canTrade: false
            })
        });

        // Запрос на продажу USDT
        const sellResponse = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                userId: "",
                tokenId: "USDT",
                currencyId: "UAH",
                payment: paymentFilter,
                side: "0",
                size: "20",
                page: "1",
                amount: minAmount.toString(),
                authMaker: false,
                canTrade: false
            })
        });

        if (buyResponse.ok && sellResponse.ok) {
            const buyData = await buyResponse.json();
            const sellData = await sellResponse.json();
            
            // Фильтруем новых пользователей
            const filterNewUsers = (items) => {
                return items.filter(item => {
                    const isNewUserOffer = item.isNewUserOffer || item.newUserOffer || false;
                    return !isNewUserOffer;
                });
            };

            const filteredBuyData = {
                ...buyData,
                result: {
                    ...buyData.result,
                    items: filterNewUsers(buyData.result?.items || [])
                }
            };

            const filteredSellData = {
                ...sellData,
                result: {
                    ...sellData.result,
                    items: filterNewUsers(sellData.result?.items || [])
                }
            };
            
            // Сохраняем данные
            saveToHistory(filteredBuyData, filteredSellData, minAmount, bank);
        }
        
    } catch (error) {
        console.error('❌ Ошибка серверного мониторинга:', error);
    }
}

// API для управления серверным мониторингом
app.post('/api/monitoring/start', (req, res) => {
    try {
        const { minAmount = 5000, bank = '' } = req.body;
        
        if (isMonitoringActive) {
            return res.json({
                success: false,
                message: 'Мониторинг уже запущен'
            });
        }

        currentMonitoringSettings = { minAmount, bank };
        startServerMonitoring();
        
        res.json({
            success: true,
            message: 'Серверный мониторинг запущен'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/monitoring/stop', (req, res) => {
    try {
        stopServerMonitoring();
        
        res.json({
            success: true,
            message: 'Серверный мониторинг остановлен'
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/api/monitoring/status', (req, res) => {
    res.json({
        success: true,
        isActive: isMonitoringActive,
        settings: currentMonitoringSettings,
        recordsCount: priceHistory.length
    });
});

// API endpoint для получения P2P данных (для ручных запросов)
app.post('/api/p2p-data', async (req, res) => {
    try {
        const { minAmount = 5000, bank = '' } = req.body;
        console.log(`Запрос P2P данных Bybit с мин. суммой: ${minAmount} ₴, банк: ${bank || 'все'}`);
        
        const paymentFilter = [];
        
        // Запрос на покупку USDT
        const buyResponse = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                userId: "",
                tokenId: "USDT",
                currencyId: "UAH",
                payment: paymentFilter,
                side: "1",
                size: "20",
                page: "1",
                amount: minAmount.toString(),
                authMaker: false,
                canTrade: false
            })
        });

        // Запрос на продажу USDT
        const sellResponse = await fetch('https://api2.bybit.com/fiat/otc/item/online', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            body: JSON.stringify({
                userId: "",
                tokenId: "USDT",
                currencyId: "UAH",
                payment: paymentFilter,
                side: "0",
                size: "20",
                page: "1",
                amount: minAmount.toString(),
                authMaker: false,
                canTrade: false
            })
        });

        if (!buyResponse.ok || !sellResponse.ok) {
            throw new Error('Ошибка получения данных от Bybit');
        }

        const buyData = await buyResponse.json();
        const sellData = await sellResponse.json();

        console.log(`Сырых данных получено: покупка ${buyData.result?.items?.length || 0}, продажа ${sellData.result?.items?.length || 0}`);
        
        // Фильтруем новых пользователей
        const filterNewUsers = (items) => {
            return items.filter(item => {
                const isNewUserOffer = item.isNewUserOffer || item.newUserOffer || false;
                return !isNewUserOffer;
            });
        };

        const filteredBuyData = {
            ...buyData,
            result: {
                ...buyData.result,
                items: filterNewUsers(buyData.result?.items || [])
            }
        };

        const filteredSellData = {
            ...sellData,
            result: {
                ...sellData.result,
                items: filterNewUsers(sellData.result?.items || [])
            }
        };

        console.log(`После фильтрации новых пользователей: покупка ${filteredBuyData.result.items.length}, продажа ${filteredSellData.result.items.length}`);
        
        // Сохраняем данные в историю
        saveToHistory(filteredBuyData, filteredSellData, minAmount, bank);
        
        res.json({
            success: true,
            buyData: filteredBuyData,
            sellData: filteredSellData,
            minAmount,
            bank: bank || 'все',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Ошибка API:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API endpoint для получения аналитики
app.get('/api/analytics', (req, res) => {
    try {
        if (priceHistory.length === 0) {
            return res.json({
                success: true,
                message: 'Нет данных для анализа',
                totalRecords: 0,
                hourlyAnalytics: [],
                latestData: []
            });
        }

        // Аналитика по часам
        const hourlyData = {};
        
        priceHistory.forEach(record => {
            const hour = record.hour;
            if (!hourlyData[hour]) {
                hourlyData[hour] = {
                    hour: hour,
                    count: 0,
                    avgBuyPrice: 0,
                    avgSellPrice: 0,
                    avgSpread: 0,
                    minBuyPrice: record.buyPrice,
                    maxSellPrice: record.sellPrice,
                    records: []
                };
            }

            const hd = hourlyData[hour];
            hd.count++;
            hd.avgBuyPrice = (hd.avgBuyPrice * (hd.count - 1) + record.buyPrice) / hd.count;
            hd.avgSellPrice = (hd.avgSellPrice * (hd.count - 1) + record.sellPrice) / hd.count;
            hd.avgSpread = (hd.avgSpread * (hd.count - 1) + record.spreadPercent) / hd.count;
            hd.minBuyPrice = Math.min(hd.minBuyPrice, record.buyPrice);
            hd.maxSellPrice = Math.max(hd.maxSellPrice, record.sellPrice);
        });

        // Превращаем в массив и сортируем по часам
        const hourlyAnalytics = Object.values(hourlyData).sort((a, b) => a.hour - b.hour);

        res.json({
            success: true,
            totalRecords: priceHistory.length,
            hourlyAnalytics: hourlyAnalytics,
            latestData: priceHistory.slice(-10).reverse() // Последние 10 записей
        });

    } catch (error) {
        console.error('❌ Ошибка анализа данных:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API для экспорта/импорта данных
app.get('/api/export-data', (req, res) => {
    try {
        // Принудительно сохраняем перед экспортом
        saveHistoryToFile();
        
        res.json({
            success: true,
            data: priceHistory,
            totalRecords: priceHistory.length,
            exportDate: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.post('/api/import-data', (req, res) => {
    try {
        const { data } = req.body;
        
        if (!Array.isArray(data)) {
            throw new Error('Данные должны быть массивом');
        }
        
        priceHistory.length = 0; // Очищаем текущие данные
        priceHistory.push(...data); // Добавляем импортированные
        
        saveHistoryToFile();
        
        res.json({
            success: true,
            message: `Импортировано ${data.length} записей`,
            totalRecords: priceHistory.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен: http://localhost:${PORT}`);
    console.log('📊 P2P мониторинг готов к работе');
    
    // Сохраняем данные при завершении работы
    process.on('SIGINT', () => {
        console.log('\n⏹️ Завершение работы сервера...');
        saveHistoryToFile();
        process.exit(0);
    });
});