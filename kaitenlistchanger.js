// ==UserScript==
// @name         KaitenListChanger
// @version      1.1
// @author       Андрей Кокорев
// @description  Drag-and-drop для полей карточки Kaiten с сохранением порядка
// @match        https://kaiten.*/*
// @require      https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'kaitenFieldOrder';

    function getCardContent() {
        return document.querySelector('div.cardContent');
    }

    function findFieldBlocks(cardContent) {
        const h6List = cardContent.querySelectorAll('h6');
        const used = new Set();
        const fields = [];

        h6List.forEach(h6 => {
            const title = h6.textContent.trim();
            if (!title) return;

            // Ищем ближайший div с классом на v4- (Kaiten Vue 4)
            let block = h6.closest('div[class^="v4-"]');
            if (!block) return;

            // Поднимаемся по иерархии до прямого ребёнка cardContent,
            // но останавливаемся, если родитель содержит другой заголовок h6
            let container = block;
            while (
                container &&
                container.parentElement &&
                container.parentElement !== cardContent
            ) {
                const siblingH6 = container.parentElement.querySelector('h6');
                if (siblingH6 && siblingH6 !== h6) break;
                container = container.parentElement;
            }

            if (!container || used.has(container)) return;

            used.add(container);
            container.classList.add('kaiten-draggable');
            fields.push({ name: title, element: container });
        });

        return fields;
    }

    function saveOrder(order) {
        GM_setValue(STORAGE_KEY, JSON.stringify(order));
    }

    function loadOrder() {
        try {
            return JSON.parse(GM_getValue(STORAGE_KEY, '[]'));
        } catch (e) {
            console.warn('[Kaiten Sort] Не удалось загрузить порядок полей:', e);
            return [];
        }
    }

    function applyOrder(fields, savedOrder) {
        const parent = fields[0]?.element?.parentElement;
        if (!parent || !savedOrder || savedOrder.length === 0) return;

        const orderMap = new Map(savedOrder.map((name, i) => [name, i]));

        // Клонируем массив, чтобы не мутировать оригинальный порядок аргументов
        const sorted = [...fields].sort((a, b) => {
            const ai = orderMap.has(a.name) ? orderMap.get(a.name) : Infinity;
            const bi = orderMap.has(b.name) ? orderMap.get(b.name) : Infinity;
            return ai - bi;
        });

        sorted.forEach(f => parent.appendChild(f.element));
    }

    function enableDrag(fields) {
        const parent = fields[0]?.element?.parentElement;
        if (!parent) return;

        // Уничтожаем предыдущий инстанс, если DOM переиспользуется
        if (parent._kaitenSortable) {
            parent._kaitenSortable.destroy();
        }

        parent._kaitenSortable = new Sortable(parent, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            draggable: '.kaiten-draggable',
            handle: 'h6',
            onEnd: () => {
                const newOrder = Array.from(parent.children)
                    .map(el => {
                        const h = el.querySelector('h6');
                        return h ? h.textContent.trim() : null;
                    })
                    .filter(Boolean);

                saveOrder(newOrder);
                console.log('[Kaiten Sort] Новый порядок сохранён:', newOrder);
            }
        });
    }

    function initOnce() {
        const cardContent = getCardContent();
        if (!cardContent) return;

        const fields = findFieldBlocks(cardContent);
        if (fields.length === 0) return;

        const saved = loadOrder();
        applyOrder(fields, saved);
        enableDrag(fields);

        console.log('[Kaiten Sort] Инициализация завершена');
    }

    function observeCardOpen() {
        let debounceTimer;
        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(initOnce, 250);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // Запуск
    initOnce();
    observeCardOpen();
})();
