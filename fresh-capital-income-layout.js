(() => {
  function applyStyles() {
    if (document.getElementById('freshCapitalIncomeLayoutStyles')) return;
    const st = document.createElement('style');
    st.id = 'freshCapitalIncomeLayoutStyles';
    st.textContent = `
      #freshCapitalSection .income-payout-strip{
        display:grid !important;
        grid-template-columns:repeat(2,minmax(0,1fr)) !important;
        grid-auto-rows:1fr !important;
        gap:8px !important;
        width:100% !important;
        margin:8px 0 4px !important;
        align-items:stretch !important;
      }
      #freshCapitalSection .income-payout-chip{
        box-sizing:border-box !important;
        width:100% !important;
        min-width:0 !important;
        height:100% !important;
        min-height:78px !important;
        padding:10px 12px !important;
        margin:0 !important;
        display:grid !important;
        grid-template-rows:minmax(2.7em,auto) auto !important;
        align-content:center !important;
        gap:5px !important;
        border-radius:12px !important;
      }
      #freshCapitalSection .income-payout-chip small{
        display:flex !important;
        align-items:flex-start !important;
        min-width:0 !important;
        min-height:2.7em !important;
        margin:0 !important;
        line-height:1.35 !important;
        white-space:normal !important;
        overflow:visible !important;
        text-overflow:clip !important;
      }
      #freshCapitalSection .income-payout-chip strong{
        display:block !important;
        align-self:end !important;
        margin:0 !important;
        line-height:1.2 !important;
      }
      @media(max-width:520px){
        #freshCapitalSection .income-payout-strip{
          grid-template-columns:repeat(2,minmax(0,1fr)) !important;
          gap:8px !important;
        }
        #freshCapitalSection .income-payout-chip{
          min-height:82px !important;
          padding:9px 10px !important;
          grid-template-rows:minmax(2.8em,auto) auto !important;
        }
        #freshCapitalSection .income-payout-chip small{
          min-height:2.8em !important;
          font-size:.57rem !important;
        }
        #freshCapitalSection .income-payout-chip strong{
          font-size:.76rem !important;
        }
      }
    `;
    document.head.appendChild(st);
  }
  applyStyles();
})();