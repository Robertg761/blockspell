import { SHOP, wallet, type ShopItem } from '../wallet';
import { h } from './dom';
import './panels.css';

/** The 🪙 panel: what coins buy. `onChange` runs after something is bought or put on. */
export function shopPanel(onChange: () => void, onBack: () => void): HTMLElement {
  const list = h('div.trophy-list');
  const sum = h('p.trophy-sum');
  const draw = () => {
    sum.textContent = `You have ${wallet.coins} coin${wallet.coins === 1 ? '' : 's'}. Break rocks with a pickaxe or finish tasks to earn more.`;
    list.replaceChildren(...SHOP.map(row));
  };
  const act = (fn: () => void) => () => {
    fn();
    onChange();
    draw();
  };
  const row = (item: ShopItem) => {
    const owned = wallet.owns(item.id);
    const worn = wallet.shirt === item.id;
    const button = !owned
      ? h('button.btn.small', { type: 'button', text: `🪙 ${item.cost}`, disabled: wallet.coins < item.cost ? 'true' : undefined, onClick: act(() => wallet.buy(item)) })
      : item.color
        ? h('button.btn.small', { type: 'button', text: worn ? 'Take off' : 'Wear', onClick: act(() => wallet.wear(worn ? null : item.id)) })
        : h('span.trophy-prog', { text: 'Yours' });
    return h(`div.trophy${owned ? '' : '.locked'}`, {}, [
      h('span.trophy-icon', { text: item.icon }),
      h('div', { style: 'flex:1' }, [h('div.trophy-name', { text: item.name }), h('div.trophy-desc', { text: item.desc })]),
      button,
    ]);
  };
  draw();
  return h('div.panel.trophies', {}, [
    h('h2', { text: '🪙 Shop' }),
    sum,
    list,
    h('div.panel-actions', {}, [h('button.btn', { type: 'button', text: 'Done', onClick: onBack })]),
  ]);
}
