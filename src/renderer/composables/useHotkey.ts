// src/renderer/composables/useHotkey.ts — Keyboard shortcut management composable
import { onMounted, onUnmounted } from 'vue';

type KeyHandler = (event: KeyboardEvent) => void;

interface HotkeyBinding {
    key: string;
    ctrl?: boolean;
    meta?: boolean;
    shift?: boolean;
    alt?: boolean;
    handler: KeyHandler;
    preventDefault?: boolean;
}

export function useHotkey(bindings: HotkeyBinding[]) {
    function handleKeydown(event: KeyboardEvent): void {
        for (const binding of bindings) {
            const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase();
            const ctrlMatch = binding.ctrl ? event.ctrlKey || event.metaKey : true;
            const shiftMatch = binding.shift ? event.shiftKey : true;
            const altMatch = binding.alt ? event.altKey : true;

            if (keyMatch && ctrlMatch && shiftMatch && altMatch) {
                if (binding.preventDefault !== false) {
                    event.preventDefault();
                    event.stopPropagation();
                }
                binding.handler(event);
                return;
            }
        }
    }

    onMounted(() => {
        window.addEventListener('keydown', handleKeydown);
    });

    onUnmounted(() => {
        window.removeEventListener('keydown', handleKeydown);
    });
}

// Pre-built bindings for common actions
export function useEditorHotkeys(options: {
    onSubmit: () => void;
    onClose: () => void;
    onBold?: (event: KeyboardEvent) => void;
    onItalic?: (event: KeyboardEvent) => void;
}) {
    useHotkey([
        {
            key: 'Enter',
            ctrl: true,
            handler: () => options.onSubmit(),
        },
        {
            key: 'Escape',
            handler: () => options.onClose(),
        },
        {
            key: 'b',
            ctrl: true,
            handler: (e) => options.onBold?.(e),
        },
        {
            key: 'i',
            ctrl: true,
            handler: (e) => options.onItalic?.(e),
        },
    ]);
}
