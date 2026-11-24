import { Link } from "react-router";
import { CATEGORY_ICON, CATEGORY_LABEL, SOURCE_LABEL } from "../lib/categories";
import { dayLabel } from "../lib/dates";
import { formatEuro } from "../lib/money";
import type { Transaction } from "../lib/types";
import { Icon } from "./Icon";

export function TransactionRow({
  t,
  today,
  showDate = true,
}: {
  t: Transaction;
  today: string;
  showDate?: boolean;
}) {
  const income = t.amount > 0;
  const source = SOURCE_LABEL[t.source];
  const sub = [CATEGORY_LABEL[t.category], showDate ? dayLabel(t.date, today) : null, source || null]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link to={`/movimientos/${t.id}`} className="b-row">
      <span className={`b-avatar${income ? " b-avatar--income" : ""}`}>
        <Icon name={CATEGORY_ICON[t.category]} />
      </span>
      <div className="b-row__main">
        <p className="b-title">{t.concept}</p>
        <p className="b-sub">{sub}</p>
      </div>
      <span className={`b-money${income ? " b-money--income" : ""}`}>
        {formatEuro(t.amount, { signed: true })}
      </span>
    </Link>
  );
}
