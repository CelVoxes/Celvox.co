import { Icons } from "../icons";

export function Spinner() {
  return <span className="animate-spin inline-block color-aaa ">
    <Icons.spinner color="#aaa" 
      width="12"
      height="12"			
      strokeWidth="3"/>
  </span>
}