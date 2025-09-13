// This file should be at: /api/search.js

// This is the same backend logic, formatted for Vercel Serverless Functions.
export default async function handler(request, response) {
  // Set CORS headers for all responses
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (request.method === 'OPTIONS') {
    return response.status(204).send('');
  }

  const { term } = request.query;

  if (!term) {
    return response.status(400).json({ error: 'Search term is missing' });
  }

  try {
    const encodedSearchTerm = encodeURIComponent(term.trim());
    const zazzleApiUrl = `https://www.zazzle.com/svc/z3/search/GetSearchWithProperties?cv=1&diffParameters=st%2Cpg%2Csd%2Cqs&diffProperties=ProductSearchTopIds&parameters=st%3Dorderitemcount_all%26pg%3D1%26sd%3Ddesc%26qs%3D${encodedSearchTerm}&properties=LightProductObjects%3Dfalse%26Maturity%3DR%26IsPublic%3Dtrue%26ShowFullSearchPages%3Dfalse%26LookAheadPages%3D16%26LimitTypesInSearch%3Dtrue%26MaxStoresPerPage%3D6%26IsHumanSearch%3Dfalse%26UserDefaultPageSize%3D120%26GetAggregations%3Dtrue%26LegoStoreAggregation%3Dfalse%26LegoStoreCategoryAggregation%3Dfalse%26UseCYOSearch%3Dfalse%26IgnoreCYOManual%3Dfalse%26GetGuidedSearch%3Dtrue%26IsBestSellerSearch%3Dtrue%26EnablePriceFilter%3Dfalse%26MinPrice%3D0%26MaxPrice%3D0%26ProductLimit%3D1%26DiversityMinScoreFactor%3D-1%26DiversityLimitWindowSize%3D16%26ProductDepartmentUrl%3D0%26IsBestGuessSearch%3Dfalse%26EnableNLS%3Dfalse&type=SearchResultsData&client=js`;

    const zazzleResponse = await fetch(zazzleApiUrl, { headers: { 'Accept': 'application/json' }});
    if (!zazzleResponse.ok) {
      throw new Error(`Zazzle API returned status: ${zazzleResponse.status}`);
    }

    const data = await zazzleResponse.json();
    if (!data?.success || !data?.data?.search?.searchResultsData?.products) {
      throw new Error('Invalid data structure from Zazzle API');
    }
    
    const products = data.data.search.searchResultsData.products;

    // Analysis functions are nested here for simplicity
    const getBadgeValue = (product, badgeType, valueKey) => {
        if (!product?.badges?.length) return null;
        const badge = product.badges.find(b => b.type === badgeType);
        return badge ? badge[valueKey] : null;
    };
    const analyzeKeywords = (prods) => { /* ... same logic ... */ };
    
    const analysisResult = { /* ... create the analysis object ... */ };

    return response.status(200).json({
        products: products,
        // ... include analysis results ...
    });

  } catch (error) {
    console.error('API Error:', error);
    return response.status(500).json({ error: error.message });
  }
}