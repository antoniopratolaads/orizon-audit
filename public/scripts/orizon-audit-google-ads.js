/**
 * ══════════════════════════════════════════════════════════════
 *   ORIZON — Google Ads Audit Data Export v4.0
 *   Script SINGOLO ACCOUNT — Estrazione completa + GMC + PMax
 * ══════════════════════════════════════════════════════════════
 *
 *   ORDINE OTTIMIZZATO: tab leggeri/critici PRIMA, prodotti ULTIMI
 *
 *   1.  Riepilogo           KPI + auto-tagging + auto-apply
 *   2.  Campagne Attive     Solo campagne attive
 *   3.  Campagne in Pausa   Solo nome/tipo (sintetico)
 *   4.  Keyword + QS        Quality Score + componenti
 *   5.  Search Terms        Solo campagne attive
 *   6.  Annunci             Solo campagne attive
 *   7.  RSA Dettaglio       Testi headline/description
 *   8.  Estensioni          Solo campagne attive
 *   9.  Conversioni         Setup (senza metriche)
 *   10. Per Device           
 *   11. Per Geo              
 *   12. Per Giorno-Ora       
 *   13. Ad Schedule          
 *   14. Trend Settimanale    13 settimane
 *   15. Trend Mensile YoY    13 mesi
 *   16. Change History       30 giorni
 *   17. Audience Lists       
 *   18. Recommendations      
 *   --- ECOM: tab leggeri prima, pesanti dopo ---
 *   19. PMax Asset           Rendimento asset per gruppo
 *   20. PMax Signals         Search themes + audience signals
 *   21. GMC Diagnostica      Stato prodotti feed
 *   22. GMC Riepilogo        Conteggi + problemi frequenti
 *   23. Prodotti             TOP 5000 per impression (ultimo!)
 *
 * ══════════════════════════════════════════════════════════════
 */

var NOME_CLIENTE = "Nome Cliente";
var ECOM = true;
var GIORNI = 90;
var CARTELLA_DRIVE = "";

function main() {
  var p = periodo(GIORNI), p13m = periodo(395);
  L("═══ ORIZON Audit v4.0 ═══");
  L(NOME_CLIENTE+" | "+(ECOM?"Ecom":"LeadGen")+" | "+p.da+" → "+p.a);
  try { var url=run(p,p13m); L("\n═══ FATTO ═══\n"+url); } catch(e) { L("✗ FATALE: "+e.message); }
}

function run(p, p13m) {
  var ss = SpreadsheetApp.create("ORIZON Audit — "+NOME_CLIENTE+" — "+p.a);
  if(CARTELLA_DRIVE){var f=DriveApp.getFileById(ss.getId());DriveApp.getFolderById(CARTELLA_DRIVE).addFile(f);DriveApp.getRootFolder().removeFile(f);}

  // ━━━ 1. RIEPILOGO + IMPOSTAZIONI ━━━
  L("Riepilogo");
  var t1=ss.getActiveSheet(); t1.setName("Riepilogo");
  var info=[["ORIZON Audit Data Export v4.0",""],["",""],
    ["Cliente",NOME_CLIENTE],["Account ID",AdsApp.currentAccount().getCustomerId()],
    ["Tipologia",ECOM?"E-commerce":"Lead Generation"],["Periodo",p.da+" → "+p.a],
    ["Data export",Utilities.formatDate(new Date(),"Europe/Rome","dd/MM/yyyy HH:mm")],
    ["",""],["═══ IMPOSTAZIONI ACCOUNT ═══",""]];
  try{
    var cs=AdsApp.search("SELECT customer.auto_tagging_enabled,customer.tracking_url_template,customer.final_url_suffix FROM customer LIMIT 1");
    if(cs.hasNext()){var c=cs.next();
      info.push(["Auto-tagging",v(c,"customer","autoTaggingEnabled")?"SÌ ✓":"NO ✗"]);
      info.push(["Tracking template",v(c,"customer","trackingUrlTemplate")||"Non configurato"]);
      info.push(["Final URL suffix",v(c,"customer","finalUrlSuffix")||"Non configurato"]);}
  }catch(e){info.push(["Errore impostazioni",e.message]);}
  // Auto-apply recommendations
  info.push(["",""],["═══ AUTO-APPLY RECOMMENDATIONS ═══",""]);
  try{
    var aar=AdsApp.search("SELECT customer.auto_tagging_enabled FROM customer LIMIT 1");
    // auto_apply non è direttamente in GAQL, proviamo recommendation con applied
    var recAuto=AdsApp.search("SELECT recommendation.type FROM recommendation WHERE recommendation.dismissed=FALSE LIMIT 100");
    var recTypes={};
    while(recAuto.hasNext()){var rr=recAuto.next();var rt=v(rr,"recommendation","type")||"?";recTypes[rt]=(recTypes[rt]||0)+1;}
    info.push(["Raccomandazioni attive",Object.keys(recTypes).length+" tipi"]);
    for(var rk in recTypes) info.push(["  "+rk,recTypes[rk]+" attive"]);
    info.push(["",""],["NOTA: verificare manualmente in","Impostazioni > Auto-apply per vedere quali sono automatiche"]);
  }catch(e){info.push(["Auto-apply","Non verificabile via API: "+e.message]);info.push(["","Verificare manualmente in Impostazioni > Auto-apply"]);}
  // Metriche
  info.push(["",""],["═══ METRICHE ACCOUNT ═══",""]);
  var tot={c:0,i:0,k:0,cv:0,vl:0};
  try{var mr=AdsApp.search("SELECT metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.conversions,metrics.conversions_value FROM customer WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"'");
    while(mr.hasNext()){var r=mr.next();tot.c+=N(v(r,"metrics","costMicros"));tot.i+=N(v(r,"metrics","impressions"));tot.k+=N(v(r,"metrics","clicks"));tot.cv+=N(v(r,"metrics","conversions"));tot.vl+=N(v(r,"metrics","conversionsValue"));}}catch(e){}
  var cE=tot.c/1e6;
  info.push(["Costo","€"+cE.toFixed(2)],["Impressioni",tot.i],["Clic",tot.k],["CTR",(tot.i>0?(tot.k/tot.i*100):0).toFixed(2)+"%"],["CPC Medio","€"+(tot.k>0?(cE/tot.k):0).toFixed(2)],["Conversioni",R(tot.cv)],["Valore Conv.","€"+tot.vl.toFixed(2)],["Conv. Rate",(tot.k>0?(tot.cv/tot.k*100):0).toFixed(2)+"%"],["CPA","€"+(tot.cv>0?(cE/tot.cv):0).toFixed(2)],["ROAS",(cE>0?(tot.vl/cE):0).toFixed(2)+"x"]);
  t1.getRange(1,1,info.length,2).setValues(info);
  t1.setColumnWidth(1,350);t1.setColumnWidth(2,350);
  t1.getRange(1,1).setFontSize(14).setFontWeight("bold");

  // ━━━ 2. CAMPAGNE ATTIVE ━━━
  L("Campagne Attive");
  Q(ss.insertSheet("Campagne Attive"),
    "SELECT campaign.name,campaign.advertising_channel_type,campaign.bidding_strategy_type,campaign.target_roas.target_roas,campaign.target_cpa.target_cpa_micros,metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.ctr,metrics.average_cpc,metrics.conversions,metrics.conversions_value,metrics.cost_per_conversion,metrics.search_impression_share,metrics.search_budget_lost_impression_share,metrics.search_rank_lost_impression_share FROM campaign WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status='ENABLED' ORDER BY metrics.cost_micros DESC",
    ["Campagna","Tipo","Bid Strategy","TROAS","TCPA","Costo","Impr.","Clic","CTR","CPC","Conv.","Valore","CPA","QI","% Budget","% Ranking"],
    function(r){return[v(r,"campaign","name"),tCamp(v(r,"campaign","advertisingChannelType")),tBid(v(r,"campaign","biddingStrategyType")),vn(r,"campaign","targetRoas","targetRoas")||"—",M(vn(r,"campaign","targetCpa","targetCpaMicros")),M(v(r,"metrics","costMicros")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),P(v(r,"metrics","ctr")),M(v(r,"metrics","averageCpc")),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue")),M(v(r,"metrics","costPerConversion")),P(v(r,"metrics","searchImpressionShare")),P(v(r,"metrics","searchBudgetLostImpressionShare")),P(v(r,"metrics","searchRankLostImpressionShare"))];}
  );

  // ━━━ 3. CAMPAGNE IN PAUSA (sintetico) ━━━
  L("Campagne in Pausa");
  Q(ss.insertSheet("Campagne in Pausa"),
    "SELECT campaign.name,campaign.advertising_channel_type,campaign.bidding_strategy_type,metrics.cost_micros,metrics.conversions,metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status='PAUSED' ORDER BY campaign.name",
    ["Campagna","Tipo","Bid Strategy","Costo","Conv.","Valore"],
    function(r){return[v(r,"campaign","name"),tCamp(v(r,"campaign","advertisingChannelType")),tBid(v(r,"campaign","biddingStrategyType")),M(v(r,"metrics","costMicros")),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue"))];}
  );

  // ━━━ 4. KEYWORD + QS ━━━
  L("Keyword + QS");
  Q(ss.insertSheet("Keyword + QS"),
    "SELECT campaign.name,ad_group.name,ad_group_criterion.keyword.text,ad_group_criterion.keyword.match_type,ad_group_criterion.quality_info.quality_score,ad_group_criterion.quality_info.creative_quality_score,ad_group_criterion.quality_info.search_predicted_ctr,ad_group_criterion.quality_info.post_click_quality_score,metrics.impressions,metrics.clicks,metrics.cost_micros,metrics.conversions,metrics.conversions_value FROM keyword_view WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND ad_group_criterion.status='ENABLED' AND campaign.status='ENABLED' ORDER BY metrics.cost_micros DESC",
    ["Campagna","Ad Group","Keyword","Match","QS","Pertinenza","CTR Prev.","Landing Page","Impr.","Clic","Costo","Conv.","Valore"],
    function(r){return[v(r,"campaign","name"),v(r,"adGroup","name"),vn(r,"adGroupCriterion","keyword","text"),tMatch(vn(r,"adGroupCriterion","keyword","matchType")),vn3(r,"adGroupCriterion","qualityInfo","qualityScore")||"—",tQual(vn3(r,"adGroupCriterion","qualityInfo","creativeQualityScore")),tQual(vn3(r,"adGroupCriterion","qualityInfo","searchPredictedCtr")),tQual(vn3(r,"adGroupCriterion","qualityInfo","postClickQualityScore")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),M(v(r,"metrics","costMicros")),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue"))];}
  );

  // ━━━ 5. SEARCH TERMS ━━━
  L("Search Terms");
  Q(ss.insertSheet("Search Terms"),
    "SELECT search_term_view.search_term,campaign.name,ad_group.name,search_term_view.status,metrics.impressions,metrics.clicks,metrics.cost_micros,metrics.conversions,metrics.conversions_value FROM search_term_view WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status='ENABLED' ORDER BY metrics.cost_micros DESC",
    ["Termine","Campagna","Ad Group","Stato","Impr.","Clic","Costo","Conv.","Valore"],
    function(r){return[v(r,"searchTermView","searchTerm"),v(r,"campaign","name"),v(r,"adGroup","name"),tST(v(r,"searchTermView","status")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),M(v(r,"metrics","costMicros")),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue"))];}
  );

  // ━━━ 6. ANNUNCI ━━━
  L("Annunci");
  Q(ss.insertSheet("Annunci"),
    "SELECT campaign.name,ad_group.name,ad_group_ad.ad.type,ad_group_ad.status,ad_group_ad.ad_strength,metrics.impressions,metrics.clicks,metrics.ctr,metrics.conversions,metrics.conversions_value FROM ad_group_ad WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status='ENABLED' AND ad_group_ad.status!='REMOVED' ORDER BY metrics.impressions DESC",
    ["Campagna","Ad Group","Tipo","Stato","Efficacia","Impr.","Clic","CTR","Conv.","Valore"],
    function(r){return[v(r,"campaign","name"),v(r,"adGroup","name"),tAd(vn(r,"adGroupAd","ad","type")),tStato(v(r,"adGroupAd","status")),tEff(v(r,"adGroupAd","adStrength")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),P(v(r,"metrics","ctr")),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue"))];}
  );

  // ━━━ 7. RSA DETTAGLIO ━━━
  L("RSA Dettaglio");
  Q(ss.insertSheet("RSA Dettaglio"),
    "SELECT campaign.name,ad_group.name,ad_group_ad.ad_strength,ad_group_ad.ad.responsive_search_ad.headlines,ad_group_ad.ad.responsive_search_ad.descriptions FROM ad_group_ad WHERE campaign.status='ENABLED' AND ad_group_ad.status='ENABLED' AND ad_group_ad.ad.type='RESPONSIVE_SEARCH_AD'",
    ["Campagna","Ad Group","Efficacia","N. HL","Headline (testi)","N. Desc","Description (testi)"],
    function(r){var rsa=vn3(r,"adGroupAd","ad","responsiveSearchAd");var hl=[],ds=[];
      try{var h=rsa?rsa.headlines||[]:[];if(typeof h==="string")h=JSON.parse(h);hl=h.map(function(x){return(x.text||x.asset_text||"").toString();});}catch(e){}
      try{var d=rsa?rsa.descriptions||[]:[];if(typeof d==="string")d=JSON.parse(d);ds=d.map(function(x){return(x.text||x.asset_text||"").toString();});}catch(e){}
      return[v(r,"campaign","name"),v(r,"adGroup","name"),tEff(v(r,"adGroupAd","adStrength")),hl.length,hl.join(" | ").substring(0,500),ds.length,ds.join(" | ").substring(0,500)];}
  );

  // ━━━ 8. ESTENSIONI ━━━
  L("Estensioni");
  Q(ss.insertSheet("Estensioni"),
    "SELECT campaign.name,campaign.status,asset.type,asset.name,campaign_asset.status,metrics.impressions,metrics.clicks,metrics.ctr FROM campaign_asset WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status='ENABLED' ORDER BY campaign.name",
    ["Campagna","Tipo Asset","Nome","Stato","Impr.","Clic","CTR"],
    function(r){return[v(r,"campaign","name"),tAsset(v(r,"asset","type")),v(r,"asset","name")||"—",tStato(v(r,"campaignAsset","status")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),P(v(r,"metrics","ctr"))];}
  );

  // ━━━ 9. CONVERSIONI (senza metriche) ━━━
  L("Conversioni");
  Q(ss.insertSheet("Conversioni"),
    "SELECT conversion_action.name,conversion_action.category,conversion_action.type,conversion_action.status,conversion_action.counting_type,conversion_action.attribution_model_settings.attribution_model,conversion_action.primary_for_goal,conversion_action.click_through_lookback_window_days,conversion_action.view_through_lookback_window_days FROM conversion_action ORDER BY conversion_action.name",
    ["Nome","Categoria","Tipo/Origine","Stato","Conteggio","Attribuzione","Primaria/Sec.","Finestra Click","Finestra View"],
    function(r){return[v(r,"conversionAction","name"),v(r,"conversionAction","category"),tConv(v(r,"conversionAction","type")),tStato(v(r,"conversionAction","status")),tCount(v(r,"conversionAction","countingType")),tAttr(vn3(r,"conversionAction","attributionModelSettings","attributionModel")),v(r,"conversionAction","primaryForGoal")?"Primaria":"Secondaria",(v(r,"conversionAction","clickThroughLookbackWindowDays")||"—")+" gg",(v(r,"conversionAction","viewThroughLookbackWindowDays")||"—")+" gg"];}
  );

  // ━━━ 10. PER DEVICE ━━━
  L("Per Device");
  Q(ss.insertSheet("Per Device"),
    "SELECT campaign.name,segments.device,metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.ctr,metrics.conversions,metrics.conversions_value,metrics.cost_per_conversion FROM campaign WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status='ENABLED' ORDER BY campaign.name,metrics.cost_micros DESC",
    ["Campagna","Device","Costo","Impr.","Clic","CTR","Conv.","Valore","CPA"],
    function(r){return[v(r,"campaign","name"),tDev(v(r,"segments","device")),M(v(r,"metrics","costMicros")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),P(v(r,"metrics","ctr")),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue")),M(v(r,"metrics","costPerConversion"))];}
  );

  // ━━━ 11. PER GEO ━━━
  L("Per Geo");
  Q(ss.insertSheet("Per Geo"),
    "SELECT campaign.name,campaign.status,geographic_view.country_criterion_id,geographic_view.location_type,metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.conversions,metrics.conversions_value FROM geographic_view WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status='ENABLED' ORDER BY metrics.cost_micros DESC",
    ["Campagna","ID Geo","Tipo","Costo","Impr.","Clic","Conv.","Valore"],
    function(r){return[v(r,"campaign","name"),v(r,"geographicView","countryCriterionId")||"—",v(r,"geographicView","locationType")||"—",M(v(r,"metrics","costMicros")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue"))];}
  );

  // ━━━ 12. PER GIORNO-ORA ━━━
  L("Per Giorno-Ora");
  Q(ss.insertSheet("Per Giorno-Ora"),
    "SELECT campaign.name,segments.day_of_week,segments.hour,metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.conversions,metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status='ENABLED' ORDER BY campaign.name,segments.day_of_week,segments.hour",
    ["Campagna","Giorno","Ora","Costo","Impr.","Clic","Conv.","Valore"],
    function(r){return[v(r,"campaign","name"),tGiorno(v(r,"segments","dayOfWeek")),v(r,"segments","hour"),M(v(r,"metrics","costMicros")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue"))];}
  );

  // ━━━ 13. AD SCHEDULE ━━━
  L("Ad Schedule");
  Q(ss.insertSheet("Ad Schedule"),
    "SELECT campaign.name,campaign_criterion.ad_schedule.day_of_week,campaign_criterion.ad_schedule.start_hour,campaign_criterion.ad_schedule.start_minute,campaign_criterion.ad_schedule.end_hour,campaign_criterion.ad_schedule.end_minute,campaign_criterion.bid_modifier FROM campaign_criterion WHERE campaign.status='ENABLED' AND campaign_criterion.type='AD_SCHEDULE' ORDER BY campaign.name",
    ["Campagna","Giorno","Inizio H","Inizio M","Fine H","Fine M","Bid Modifier"],
    function(r){return[v(r,"campaign","name"),tGiorno(vn(r,"campaignCriterion","adSchedule","dayOfWeek")),vn(r,"campaignCriterion","adSchedule","startHour"),vn(r,"campaignCriterion","adSchedule","startMinute"),vn(r,"campaignCriterion","adSchedule","endHour"),vn(r,"campaignCriterion","adSchedule","endMinute"),v(r,"campaignCriterion","bidModifier")||"—"];}
  );

  // ━━━ 14. TREND SETTIMANALE ━━━
  L("Trend Settimanale");
  Q(ss.insertSheet("Trend Settimanale"),
    "SELECT campaign.name,segments.week,metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.conversions,metrics.conversions_value,metrics.search_impression_share FROM campaign WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' AND campaign.status!='REMOVED' ORDER BY segments.week DESC,metrics.cost_micros DESC",
    ["Campagna","Settimana","Costo","Impr.","Clic","Conv.","Valore","QI"],
    function(r){return[v(r,"campaign","name"),v(r,"segments","week"),M(v(r,"metrics","costMicros")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue")),P(v(r,"metrics","searchImpressionShare"))];}
  );

  // ━━━ 15. TREND MENSILE YoY ━━━
  L("Trend Mensile");
  Q(ss.insertSheet("Trend Mensile YoY"),
    "SELECT campaign.name,segments.month,metrics.cost_micros,metrics.impressions,metrics.clicks,metrics.conversions,metrics.conversions_value FROM campaign WHERE segments.date BETWEEN '"+p13m.da+"' AND '"+p.a+"' AND campaign.status!='REMOVED' ORDER BY segments.month DESC,metrics.cost_micros DESC",
    ["Campagna","Mese","Costo","Impr.","Clic","Conv.","Valore"],
    function(r){return[v(r,"campaign","name"),v(r,"segments","month"),M(v(r,"metrics","costMicros")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue"))];}
  );

  // ━━━ 16. CHANGE HISTORY ━━━
  L("Change History");
  var ch30=periodo(30);
  Q(ss.insertSheet("Change History"),
    "SELECT change_event.change_date_time,change_event.change_resource_type,change_event.changed_fields,change_event.client_type,change_event.user_email,campaign.name FROM change_event WHERE change_event.change_date_time >= '"+ch30.da+"' AND change_event.change_date_time <= '"+ch30.a+"' ORDER BY change_event.change_date_time DESC LIMIT 500",
    ["Data","Tipo Risorsa","Campi Modificati","Client","Utente","Campagna"],
    function(r){return[v(r,"changeEvent","changeDateTime")||"—",v(r,"changeEvent","changeResourceType")||"—",String(v(r,"changeEvent","changedFields")||"—").substring(0,250),v(r,"changeEvent","clientType")||"—",v(r,"changeEvent","userEmail")||"—",v(r,"campaign","name")||"—"];}
  );

  // ━━━ 17. AUDIENCE LISTS ━━━
  L("Audience Lists");
  Q(ss.insertSheet("Audience Lists"),
    "SELECT user_list.name,user_list.type,user_list.membership_status,user_list.size_for_search,user_list.size_for_display,user_list.membership_life_span FROM user_list ORDER BY user_list.size_for_display DESC",
    ["Nome Lista","Tipo","Stato","Size Search","Size Display","Durata (gg)"],
    function(r){return[v(r,"userList","name"),tListType(v(r,"userList","type")),v(r,"userList","membershipStatus")||"—",v(r,"userList","sizeForSearch")||0,v(r,"userList","sizeForDisplay")||0,v(r,"userList","membershipLifeSpan")||"—"];}
  );

  // ━━━ 18. RECOMMENDATIONS ━━━
  L("Recommendations");
  Q(ss.insertSheet("Recommendations"),
    "SELECT recommendation.type,recommendation.campaign,recommendation.impact FROM recommendation",
    ["Tipo","Campagna","Impatto"],
    function(r){return[v(r,"recommendation","type")||"—",v(r,"recommendation","campaign")||"—",String(v(r,"recommendation","impact")||"—").substring(0,300)];}
  );

  // ━━━ ECOM ONLY — TAB LEGGERI PRIMA ━━━
  if (ECOM) {

    // ━━━ 19. PMAX ASSET (rendimento) ━━━
    L("PMax Asset");
    Q(ss.insertSheet("PMax Asset"),
      "SELECT campaign.name,asset_group.name,asset_group_asset.field_type,asset_group_asset.performance_label,asset_group_asset.status FROM asset_group_asset WHERE campaign.status='ENABLED' ORDER BY campaign.name,asset_group.name,asset_group_asset.field_type",
      ["Campagna","Asset Group","Tipo Asset","Rendimento","Stato"],
      function(r){return[v(r,"campaign","name"),v(r,"assetGroup","name"),tAssetField(v(r,"assetGroupAsset","fieldType")),tPerf(v(r,"assetGroupAsset","performanceLabel")),tStato(v(r,"assetGroupAsset","status"))];}
    );

    // ━━━ 20. PMAX SIGNALS (search themes + audience) ━━━
    L("PMax Signals");
    try {
      var tabSig = ss.insertSheet("PMax Signals");
      tabSig.appendRow(["Campagna","Asset Group","Tipo Segnale","Dettaglio"]);
      var resSig = AdsApp.search("SELECT campaign.name,asset_group.name,asset_group_signal.audience_signal FROM asset_group_signal WHERE campaign.status='ENABLED'");
      var sigRows = [];
      while(resSig.hasNext()) {
        try {
          var rs = resSig.next();
          var campName = v(rs,"campaign","name");
          var agName = v(rs,"assetGroup","name");
          var sig = v(rs,"assetGroupSignal","audienceSignal");
          if (sig) {
            // Search themes
            if (sig.searchThemes && sig.searchThemes.length) {
              sig.searchThemes.forEach(function(st) {
                sigRows.push([campName, agName, "Search Theme", st.text || st.value || String(st)]);
              });
            }
            // User interests
            if (sig.userInterests && sig.userInterests.length) {
              sig.userInterests.forEach(function(ui) {
                sigRows.push([campName, agName, "User Interest", ui.userInterestCategory || String(ui)]);
              });
            }
            // Custom audiences
            if (sig.customAudiences && sig.customAudiences.length) {
              sig.customAudiences.forEach(function(ca) {
                sigRows.push([campName, agName, "Custom Audience", ca.customAudience || String(ca)]);
              });
            }
            // If signal is a string, try to parse or just dump
            if (typeof sig === "string") {
              sigRows.push([campName, agName, "Raw Signal", sig.substring(0, 300)]);
            }
            // If signal is object but no known fields, dump it
            if (!sig.searchThemes && !sig.userInterests && !sig.customAudiences && typeof sig !== "string") {
              sigRows.push([campName, agName, "Signal Object", JSON.stringify(sig).substring(0, 300)]);
            }
          } else {
            sigRows.push([campName, agName, "Nessun segnale", "—"]);
          }
        } catch(e) {}
      }
      if (sigRows.length > 0) tabSig.getRange(2,1,sigRows.length,4).setValues(sigRows);
      L("  " + sigRows.length + " segnali");
    } catch(e) { L("  ⚠ PMax Signals: " + e.message); }

    // ━━━ 21-22. GMC DIAGNOSTICA + RIEPILOGO ━━━
    L("GMC Diagnostica");
    try {
      var tabGmc = ss.insertSheet("GMC Diagnostica");
      var hG=["ID","Titolo","Stato GMC","N. Problemi","Problemi","Disponibilità","Condizione","Brand","Cat. L1","Cat. L2"];
      tabGmc.appendRow(hG);
      var resG=AdsApp.search("SELECT shopping_product.item_id,shopping_product.title,shopping_product.status,shopping_product.issues,shopping_product.channel,shopping_product.availability,shopping_product.condition,shopping_product.brand,shopping_product.category_level1,shopping_product.category_level2 FROM shopping_product WHERE shopping_product.channel='ONLINE'");
      var rG=[],sC={},iC={},tG=0;
      while(resG.hasNext()){try{var rr=resG.next();tG++;
        var st=v(rr,"shoppingProduct","status")||"?";sC[st]=(sC[st]||0)+1;
        var iss=v(rr,"shoppingProduct","issues"),nI=0,iD=[];
        if(iss&&iss.length){nI=iss.length;for(var ii=0;ii<Math.min(iss.length,5);ii++){var d=(iss[ii].severity||"")+": "+(iss[ii].shortDescription||iss[ii].description||"");iD.push(d);var ik=d.substring(0,80);iC[ik]=(iC[ik]||0)+1;}}
        rG.push([v(rr,"shoppingProduct","itemId"),(v(rr,"shoppingProduct","title")||"").toString().substring(0,80),tGmcS(st),nI,iD.join(" | ").substring(0,300)||"—",tDisp(v(rr,"shoppingProduct","availability")),tCond(v(rr,"shoppingProduct","condition")),v(rr,"shoppingProduct","brand")||"—",v(rr,"shoppingProduct","categoryLevel1")||"—",v(rr,"shoppingProduct","categoryLevel2")||"—"]);
      }catch(e){}}
      if(rG.length>0)tabGmc.getRange(2,1,rG.length,hG.length).setValues(rG);
      L("  "+rG.length+" prodotti GMC");
      // Riepilogo
      var tabS=ss.insertSheet("GMC Riepilogo");
      var sr=[["GMC RIEPILOGO",""],["",""],["Totale prodotti feed",tG],["",""],["STATO PRODOTTI","N."]];
      ["ELIGIBLE","NOT_ELIGIBLE","PENDING","DISAPPROVED","WARNING"].forEach(function(s){if(sC[s])sr.push([tGmcS(s),sC[s]]);});
      for(var sk in sC){if(["ELIGIBLE","NOT_ELIGIBLE","PENDING","DISAPPROVED","WARNING"].indexOf(sk)===-1)sr.push([tGmcS(sk),sC[sk]]);}
      sr.push(["",""],["PROBLEMI FREQUENTI","N."]);
      var il=[];for(var ik in iC)il.push([ik,iC[ik]]);il.sort(function(a,b){return b[1]-a[1];});
      il.slice(0,25).forEach(function(x){sr.push(x);});
      tabS.getRange(1,1,sr.length,2).setValues(sr);tabS.setColumnWidth(1,450);tabS.setColumnWidth(2,120);
      tabS.getRange(1,1).setFontSize(14).setFontWeight("bold");
    }catch(e){L("  ⚠ GMC: "+e.message);}

    // ━━━ 23. PRODOTTI (ULTIMO — top 5000 per impression) ━━━
    L("Prodotti (top 5000)");
    Q(ss.insertSheet("Prodotti"),
      "SELECT segments.product_item_id,segments.product_title,campaign.name,campaign.advertising_channel_type,metrics.impressions,metrics.clicks,metrics.cost_micros,metrics.conversions,metrics.conversions_value FROM shopping_performance_view WHERE segments.date BETWEEN '"+p.da+"' AND '"+p.a+"' ORDER BY metrics.impressions DESC LIMIT 5000",
      ["ID","Titolo","Campagna","Tipo","Impr.","Clic","Costo","Conv.","Valore"],
      function(r){return[v(r,"segments","productItemId"),v(r,"segments","productTitle"),v(r,"campaign","name"),tCamp(v(r,"campaign","advertisingChannelType")),v(r,"metrics","impressions"),v(r,"metrics","clicks"),M(v(r,"metrics","costMicros")),R(v(r,"metrics","conversions")),R(v(r,"metrics","conversionsValue"))];}
    );
  }

  FMT(ss);
  return ss.getUrl();
}

// ━━━ QUERY RUNNER ━━━
function Q(tab,query,headers,mapper){
  tab.appendRow(headers);
  try{var res=AdsApp.search(query),rows=[];
    while(res.hasNext()){try{rows.push(mapper(res.next()));}catch(e){}}
    if(rows.length>0)tab.getRange(2,1,rows.length,headers.length).setValues(rows);
    L("  "+rows.length+" righe");
  }catch(e){L("  ⚠ "+e.message);tab.getRange(2,1).setValue("Errore: "+e.message);}
}

// ━━━ FORMATTAZIONE ━━━
function FMT(ss){ss.getSheets().forEach(function(tab){
  if(tab.getName()==="Riepilogo"||tab.getName()==="GMC Riepilogo")return;
  var lc=tab.getLastColumn(),lr=tab.getLastRow();if(lc<1||lr<1)return;
  tab.getRange(1,1,1,lc).setFontWeight("bold").setBackground("#1A3C6E").setFontColor("#FFF").setFontFamily("Arial").setFontSize(10).setHorizontalAlignment("center");
  if(lr>1){tab.getRange(2,1,lr-1,lc).setFontFamily("Arial").setFontSize(10);for(var r=2;r<=Math.min(lr,500);r++){if(r%2===0)tab.getRange(r,1,1,lc).setBackground("#F5F5F5");}}
  for(var c=1;c<=lc;c++)tab.autoResizeColumn(c);tab.setFrozenRows(1);
  if(lr>1)tab.getRange(1,1,lr,lc).createFilter();
});}

// ━━━ ACCESSO CAMPI ━━━
function v(r,e,f){try{return r[e]&&r[e][f]!==undefined?r[e][f]:"";}catch(x){return "";}}
function vn(r,e,s,f){try{return r[e]&&r[e][s]&&r[e][s][f]!==undefined?r[e][s][f]:"";}catch(x){return "";}}
function vn3(r,e,s1,s2){try{return r[e]&&r[e][s1]&&r[e][s1][s2]!==undefined?r[e][s1][s2]:"";}catch(x){return "";}}

// ━━━ UTIL ━━━
function M(m){return(!m||m===""||m===0)?"€0,00":"€"+(Number(m)/1e6).toFixed(2).replace(".",",");}
function P(v){return(!v&&v!==0||v==="")?"—":(Number(v)*100).toFixed(2).replace(".",",")+"%";}
function R(v){return(!v&&v!==0)?0:Math.round(Number(v)*100)/100;}
function N(v){return Number(v)||0;}
function periodo(gg){var f=new Date(),i=new Date();i.setDate(f.getDate()-gg);return{da:Utilities.formatDate(i,"Europe/Rome","yyyy-MM-dd"),a:Utilities.formatDate(f,"Europe/Rome","yyyy-MM-dd")};}
function L(m){Logger.log("→ "+m);}

// ━━━ TRADUZIONI ━━━
function tCamp(t){return{SEARCH:"Search",SHOPPING:"Shopping",PERFORMANCE_MAX:"PMax",DISPLAY:"Display",VIDEO:"Video",DISCOVERY:"Demand Gen",DEMAND_GEN:"Demand Gen",MULTI_CHANNEL:"Multi",LOCAL:"Local",SMART:"Smart"}[t]||t||"—";}
function tStato(s){return{ENABLED:"Attiva",PAUSED:"In pausa",REMOVED:"Rimossa"}[s]||s||"—";}
function tBid(b){return{TARGET_ROAS:"tROAS",TARGET_CPA:"tCPA",MAXIMIZE_CONVERSIONS:"Max Conv.",MAXIMIZE_CONVERSION_VALUE:"Max Valore",TARGET_IMPRESSION_SHARE:"Target QI",MANUAL_CPC:"CPC Man.",MAXIMIZE_CLICKS:"Max Clic",ENHANCED_CPC:"eCPC",TARGET_SPEND:"Target Spend"}[b]||b||"—";}
function tMatch(m){return{EXACT:"[Exact]",PHRASE:"\"Phrase\"",BROAD:"Broad"}[m]||m||"—";}
function tAd(t){return{RESPONSIVE_SEARCH_AD:"RSA",EXPANDED_TEXT_AD:"ETA ⚠",RESPONSIVE_DISPLAY_AD:"Display",VIDEO_AD:"Video",CALL_AD:"Call",IMAGE_AD:"Image",DEMAND_GEN_MULTI_ASSET_AD:"DG Multi",DEMAND_GEN_PRODUCT_AD:"DG Product",DEMAND_GEN_VIDEO_RESPONSIVE_AD:"DG Video",SHOPPING_PRODUCT_AD:"Shopping",EXPANDED_DYNAMIC_SEARCH_AD:"DSA",SHOPPING_SMART_AD:"Smart Shop"}[t]||t||"—";}
function tEff(e){return{EXCELLENT:"Eccellente ✓",GOOD:"Buona",AVERAGE:"Media ⚠",POOR:"Scarsa ✗",PENDING:"In attesa",UNSPECIFIED:"—",UNKNOWN:"—"}[e]||e||"—";}
function tQual(l){return{ABOVE_AVERAGE:"Sopra media ✓",AVERAGE:"Nella media",BELOW_AVERAGE:"Sotto media ✗"}[l]||l||"—";}
function tST(s){return{ADDED:"Aggiunto",EXCLUDED:"Escluso",ADDED_EXCLUDED:"Agg+Escl",NONE:"Non gestito"}[s]||s||"—";}
function tDev(d){return{MOBILE:"Mobile",DESKTOP:"Desktop",TABLET:"Tablet",CONNECTED_TV:"ConnTV",OTHER:"Altro"}[d]||d||"—";}
function tGiorno(g){return{MONDAY:"Lun",TUESDAY:"Mar",WEDNESDAY:"Mer",THURSDAY:"Gio",FRIDAY:"Ven",SATURDAY:"Sab",SUNDAY:"Dom"}[g]||g||"—";}
function tAsset(t){return{SITELINK:"Sitelink",CALL:"Chiamata",CALLOUT:"Callout",STRUCTURED_SNIPPET:"Snippet",IMAGE:"Immagine",PROMOTION:"Promozione",PRICE:"Prezzo",LEAD_FORM:"Lead Form",LOCATION:"Location",BUSINESS_NAME:"Business",CALL_TO_ACTION:"CTA",TEXT:"Testo"}[t]||t||"—";}
function tConv(t){return{AD_CALL:"Call annuncio",CLICK_TO_CALL:"Click to call",UPLOAD_CALLS:"Upload call",UPLOAD_CLICKS:"Upload click (OCT)",WEBPAGE:"Tag webpage",WEBSITE_CALL:"Call sito",STORE_SALES_DIRECT_UPLOAD:"Store sales",GOOGLE_ANALYTICS_4_CUSTOM:"GA4 Custom",GOOGLE_ANALYTICS_4_PURCHASE:"GA4 Purchase",GOOGLE_HOSTED:"Google Hosted",SMART_CAMPAIGN_AD_CLICKS_TO_CALL:"Smart Call",SMART_CAMPAIGN_MAP_CLICKS_TO_CALL:"Smart Map Call",SMART_CAMPAIGN_MAP_DIRECTIONS:"Smart Map Dir"}[t]||t||"—";}
function tCount(c){return{ONE_PER_CLICK:"Una",MANY_PER_CLICK:"Tutte"}[c]||c||"—";}
function tAttr(a){return{GOOGLE_ADS_LAST_CLICK:"Last Click",DATA_DRIVEN:"Data-Driven",LINEAR:"Lineare",TIME_DECAY:"Time Decay",POSITION_BASED:"Position",FIRST_CLICK:"First Click",EXTERNAL:"Esterno",GOOGLE_SEARCH_ATTRIBUTION_DATA_DRIVEN:"Data-Driven"}[a]||a||"—";}
function tListType(t){return{REMARKETING:"Remarketing",LOGICAL_USER_LIST:"Combinata",BASIC_USER_LIST:"Base",CRM_BASED_USER_LIST:"Customer List",RULE_BASED_USER_LIST:"Rule-based",SIMILAR_USER_LIST:"Simili"}[t]||t||"—";}
function tAssetField(t){return{HEADLINE:"Headline",LONG_HEADLINE:"Long Headline",DESCRIPTION:"Description",MARKETING_IMAGE:"Immagine",SQUARE_MARKETING_IMAGE:"Img Quadra",LOGO:"Logo",YOUTUBE_VIDEO:"Video",PORTRAIT_MARKETING_IMAGE:"Img Portrait",LANDSCAPE_LOGO:"Logo Landscape",BUSINESS_NAME:"Nome Business",CALL_TO_ACTION_SELECTION:"CTA"}[t]||t||"—";}
function tPerf(p){return{BEST:"Best ✓",GOOD:"Good",LOW:"Low ✗",PENDING:"Pending",LEARNING:"Learning",UNSPECIFIED:"—",UNKNOWN:"—",NOT_APPLICABLE:"N/A"}[p]||p||"—";}
function tGmcS(s){return{ELIGIBLE:"Approvato ✓",NOT_ELIGIBLE:"Non idoneo ✗",PENDING:"In attesa",DISAPPROVED:"Disapprovato ✗",WARNING:"Warning ⚠",APPROVED:"Approvato ✓"}[s]||s||"—";}
function tDisp(d){return{IN_STOCK:"Disponibile",OUT_OF_STOCK:"Esaurito",PREORDER:"Preordine",BACKORDER:"Riordino"}[d]||d||"—";}
function tCond(c){return{NEW:"Nuovo",USED:"Usato",REFURBISHED:"Ricondizionato"}[c]||c||"—";}
