import s from './InventoryView.module.scss';

const CARD_COUNT = 8;
const FILTER_COUNT = 3;

const SkeletonCard = () => (
  <div className={s.skeletonCard}>
    <div className={s.skeletonHead}>
      <div className={s.skeletonThumb} />
      <div className={s.skeletonHeadText}>
        <div className={`${s.skeletonLine} ${s.skeletonLineSm}`} />
        <div className={`${s.skeletonLine} ${s.skeletonLineMd}`} />
      </div>
    </div>
    <div className={s.skeletonMeta}>
      <div className={s.skeletonPrice} />
      <div className={s.skeletonWarranty} />
    </div>
    <div className={s.skeletonButton} />
  </div>
);

export const InventorySkeleton = () => (
  <div className={s.view}>
    <div className={s.toolbar}>
      <div className={s.filters}>
        {Array.from({ length: FILTER_COUNT }, (_, i) => (
          <div key={i} className={s.skeletonFilter} />
        ))}
      </div>
    </div>
    <div className={s.grid}>
      {Array.from({ length: CARD_COUNT }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  </div>
);
