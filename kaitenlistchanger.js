// ==UserScript==
// @name         KaitenListChanger
// @version      1.0
// @author       Андрей Кокорев
// @description  Drag-and-drop полей карточки Kaiten с автообновлением и увеличенной шириной
// @match        https://kaiten.*.tech/*
// ==/UserScript==

// === НАЧАЛО СКРИПТА ===
(function () {
    'use strict';

    // Ключ для хранения порядка полей в localStorage
    const STORAGE_KEY = 'kaitenFieldOrder';

    // Подгрузка библиотеки SortableJS для drag-and-drop функциональности
    function loadSortable(callback) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js';
        script.onload = callback;
        document.head.appendChild(script);
    }

    // Получение блока карточки
    function getCardContent() {
        return document.querySelector('div.cardContent');
    }

    // Поиск всех блоков с пользовательскими полями (основан на заголовках <h6>)
    function findFieldBlocks(cardContent) {
        const h6List = cardContent.querySelectorAll('h6');
        const used = new Set();
        const fields = [];

        h6List.forEach(h6 => {
            // Поднимаемся по DOM-иерархии, чтобы найти контейнер всего поля
            let block = h6.closest('div[class^="v4-"]');
            while (block && block.parentElement && block.parentElement !== cardContent && block.parentElement.querySelector('h6') === h6) {
                block = block.parentElement;
            }

            // Исключаем повторения и добавляем класс для перетаскивания
            if (block && !used.has(block)) {
                used.add(block);
                block.classList.add('kaiten-draggable');
                fields.push({ name: h6.textContent.trim(), element: block });
            }
        });

        return fields;
    }

    // Сохраняем текущий порядок в localStorage
    function saveOrder(order) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    }

    // Загружаем сохранённый порядок полей
    function loadOrder() {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    }

    // Применяем сохранённый порядок к DOM
    function applyOrder(fields, savedOrder) {
        const parent = fields[0]?.element?.parentElement;
        if (!parent) return;

        // Создаём карту с индексами сохранённых названий
        const orderMap = new Map(savedOrder.map((name, i) => [name, i]));

        // Сортировка: сначала по сохранённому порядку, затем — оставшиеся
        fields.sort((a, b) => {
            const ai = orderMap.has(a.name) ? orderMap.get(a.name) : Infinity;
            const bi = orderMap.has(b.name) ? orderMap.get(b.name) : Infinity;
            return ai - bi;
        });

        // Добавляем элементы обратно в контейнер в новом порядке
        fields.forEach(f => parent.appendChild(f.element));
    }

    // Включаем drag-and-drop для полей
    function enableDrag(fields) {
        const parent = fields[0]?.element?.parentElement;
        if (!parent) return;

        new Sortable(parent, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            draggable: '.kaiten-draggable',
            handle: 'h6', // перетаскивание по заголовку поля
            onEnd: () => {
                // При завершении перемещения сохраняем новый порядок
                const newOrder = Array.from(parent.children).map(el => {
                    const h = el.querySelector('h6');
                    return h ? h.textContent.trim() : null;
                }).filter(Boolean);

                saveOrder(newOrder);
                console.log('[Kaiten Sort] Новый порядок сохранён:', newOrder);
            }
        });
    }

    // Инициализация для текущей открытой карточки
    function initOnce() {
        const cardContent = getCardContent();
        if (!cardContent || cardContent.dataset.kaitenSorted === '1') return;

        const fields = findFieldBlocks(cardContent);
const saved = loadOrder();

        applyOrder(fields, saved);
        enableDrag(fields);

        // Ставим флаг, чтобы не инициализировать повторно
        cardContent.dataset.kaitenSorted = '1';
        console.log('[Kaiten Sort] Инициализация завершена');
    }

    // Наблюдаем за открытием карточек (динамическая загрузка через мутации)
    function observeCardOpen() {
        const observer = new MutationObserver(() => {
            initOnce(); // Пытаемся проинициализироваться при каждой мутации
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Загружаем SortableJS, затем инициализируем первый раз и включаем слежение
    loadSortable(() => {
        initOnce();         // Для первой карточки
        observeCardOpen();  // Для всех следующих
    });
})();

// === КОНЕЦ СКРИПТА ===