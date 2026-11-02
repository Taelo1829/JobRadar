import { DEFAULT_JOB_SOURCES, jobSearchUrl } from '../lib/job-sources';
import { ArrowUpRight } from 'lucide-react';
export default function SourceLinks({company='',role='',compact=false}:{company?:string;role?:string;compact?:boolean}) {
  return <section className={'source-links '+(compact?'compact':'')} aria-label="Default job search sites"><div className="source-heading">{compact?'SEARCH ON':'DEFAULT SEARCH SITES'}</div><div className="source-grid">{DEFAULT_JOB_SOURCES.map(source=><a key={source.id} href={jobSearchUrl(source.id,company,role)} target="_blank" rel="noopener noreferrer"><span>{source.name}</span><ArrowUpRight size={13}/></a>)}</div>{!compact&&<p>Open searches on these sites. Automatic monitoring and push alerts for these sources are not connected.</p>}</section>;
}
