import type { Frame, Reader } from "../spec";
import type { Body } from "../ui";
import * as compare from "./compare";
import * as stats from "./stats";
import * as bars from "./bars";
import * as table from "./table";
import * as columns from "./columns";
import * as progress from "./progress";
import * as line from "./line";

export type Template<M> = {
  parse(r: Reader): M;
  render(m: M, f: Frame): Body;
  defaultTitle?(m: M): string;
  summary?(m: M): unknown;
};

const registry = { compare, stats, bars, table, columns, progress, line };

export type TemplateName = keyof typeof registry;

export const TEMPLATES: Record<TemplateName, Template<any>> = registry;
