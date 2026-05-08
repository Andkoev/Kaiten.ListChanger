// ==UserScript==
// @name         KaitenListChanger
// @version      1.3
// @author       Андрей Кокорев
// @description  Drag-and-drop для полей карточки Kaiten с сохранением порядка
// @match        https://kaiten.*.*/*
// @require      https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'kaitenFieldOrder';
    let lastSignature = '';

    function getCardContent() {
        return document.querySelector('div.cardContent');
    }

    function getFieldName(el) {
        const h6 = el.querySelector(':scope h6');
        return h6 ? h6.textContent.trim() : null;
    }

    function findBestFieldsContainer(cardContent) {
        const h6List = Array.from(cardContent.querySelectorAll('h6'));
        const candidates = new Map();

        for (const h6 of h6List) {
            const title = h6.textContent.trim();
            if (!title) continue;

            let el = h6.parentElement;

            while (el && el !== cardContent) {
                const parent = el.parentElement;
                if (!parent || parent === cardContent) break;

                const directChildrenWithH6 = Array.from(parent.children)
                    .filter(child => child.querySelector('h6'));

                if (directChildrenWithH6.length >= 3) {
                    candidates.set(parent, directChildrenWithH6);
                }

                el = parent;
            }
        }

        let bestParent = null;
        let bestFields = [];

        for (const [parent, fields] of candidates.entries()) {
            if (fields.length > bestFields.length) {
                bestParent = parent;
                bestFields = fields;
            }
        }

        return {
            parent: bestParent,
            elements: bestFields
        };
    }

    function findFieldBlocks(cardContent) {
        const { parent, elements } = findBestFieldsContainer(cardContent);
        if (!parent || !elements.length) return [];

        return elements
            .map(el => {
                const name = getFieldName(el);
                if (!name) return null;

                el.classList.add('kaiten-draggable');

                return {
                    name,
                    element: el
                };
            })
            .filter(Boolean);
    }

    function saveOrder(order) {
        GM_setValue(STORAGE_KEY, JSON.stringify(order));
    }

    function loadOrder() {
        try {
            return JSON.parse(GM_getValue(STORAGE_KEY, '[]'));
        } catch {
            return [];
        }
    }

    function applyOrder(fields, savedOrder) {
        const parent = fields[0]?.element?.parentElement;
        if (!parent || !savedOrder.length) return;

        const orderMap = new Map(savedOrder.map((name, i) => [name, i]));

        const sorted = [...fields].sort((a, b) => {
            const ai = orderMap.has(a.name) ? orderMap.get(a.name) : 9999;
            const bi = orderMap.has(b.name) ? orderMap.get(b.name) : 9999;
            return ai - bi;
        });

        sorted.forEach(f => parent.appendChild(f.element));
    }

    function enableDrag(fields) {
        const parent = fields[0]?.element?.parentElement;
        if (!parent) return;

        if (parent._kaitenSortable) {
            parent._kaitenSortable.destroy();
        }

        parent._kaitenSortable = new Sortable(parent, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            draggable: '.kaiten-draggable',
            handle: 'h6',

            onEnd: () => {
                const newOrder = Array.from(parent.children)
                    .filter(el => el.classList.contains('kaiten-draggable'))
                    .map(getFieldName)
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
        if (!fields.length) return;

        const signature = fields.map(f => f.name).join('|');

        if (signature === lastSignature) return;
        lastSignature = signature;

        applyOrder(fields, loadOrder());
        enableDrag(fields);

        console.log('[Kaiten Sort] Инициализация:', fields.map(f => f.name));
    }

    function observeCardOpen() {
        let debounceTimer;

        const observer = new MutationObserver(() => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(initOnce, 700);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    initOnce();
    observeCardOpen();
})();