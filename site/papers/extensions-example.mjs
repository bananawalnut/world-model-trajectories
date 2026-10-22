const v={t:'var',name:'x'},t=name=>({t:'app',name,args:[]}),p=(name,arg)=>({op:'pred',name,args:[arg]}),imp=(a,b)=>({op:'imp',a,b}),not=x=>({op:'not',x}),all=body=>({op:'forall',vars:[{name:'x',sort:'Entity'}],body});
export const extensionRequest={defaultClaimIds:['birds','penguins','quakers','republicans'],targetClaimId:'target'};
export const extensionIR={sorts:['Entity'],preds:['Bird','Penguin','Fly','Quaker','Republican','Peace'].map(name=>({name,args:['Entity']})),funcs:['tweety','robin','nixon'].map(name=>({name,args:[],ret:'Entity'})),claims:[
{id:'taxonomy',source:'Penguins are birds',formula:all(imp(p('Penguin',v),p('Bird',v)))},
{id:'tweety_fact',source:'Tweety is a penguin',formula:p('Penguin',t('tweety'))},
{id:'robin_fact',source:'Robin is a bird',formula:p('Bird',t('robin'))},
{id:'quaker_fact',source:'Nixon is a Quaker',formula:p('Quaker',t('nixon'))},
{id:'republican_fact',source:'Nixon is a Republican',formula:p('Republican',t('nixon'))},
{id:'birds',source:'Birds normally fly',formula:all(imp(p('Bird',v),p('Fly',v)))},
{id:'penguins',source:'Penguins normally do not fly',formula:all(imp(p('Penguin',v),not(p('Fly',v))))},
{id:'quakers',source:'Quakers normally favour peace',formula:all(imp(p('Quaker',v),p('Peace',v)))},
{id:'republicans',source:'Republicans normally oppose peace',formula:all(imp(p('Republican',v),not(p('Peace',v))))},
{id:'target',source:'Nixon favours peace',formula:p('Peace',t('nixon'))}]};
