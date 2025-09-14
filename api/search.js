// This file is at: /api/search.js
// UPGRADED with Views, Conversion Rate, and enriched product data.

// Helper function to get badge data from a product
function getBadgeValue(product, badgeType, valueKey) {
  if (!product?.badges?.length) return null;
  const badge = product.badges.find(b => b.type === badgeType);
  return badge ? badge[valueKey] : null;
}

// Main API handler function
export default async function handler(request, response) {
  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
    if (!zazzleResponse.ok) throw new Error(`Zazzle API returned status: ${zazzleResponse.status}`);

    const data = await zazzleResponse.json();
    if (!data?.success || !data?.data?.search?.searchResultsData?.products) {
      throw new Error('Invalid data structure from Zazzle API');
    }
    
    const searchResults = data.data.search.searchResultsData;
    const rawProducts = searchResults.products;

    // --- ** NEW: Enrich each product with stats for easier use ** ---
    const enrichedProducts = rawProducts.map(product => {
        const sales = getBadgeValue(product, 'BoughtXTimesInMonth', 'orderItemCount') || 0;
        const views = getBadgeValue(product, 'XViewsInMonth', 'viewCount') || 0;
        const carts = getBadgeValue(product, 'InXCarts', 'cartCount') || 0;
        const conversionRate = (views > 0) ? (sales / views) * 100 : 0; // As a percentage

        return {
            ...product, // Keep all original product data
            stats: {     // Add a new object for our calculated stats
                sales,
                views,
                carts,
                conversionRate,
            }
        };
    });

    // --- Perform all analysis using the new enriched data ---
    const topProduct = [...enrichedProducts].sort((a, b) => b.stats.sales - a.stats.sales)[0] || null;

    const keywordCounts = {};
    enrichedProducts.forEach(product => {
      if (product.keywords) {
        product.keywords.split('+').forEach(kw => {
          const term = kw.trim();
          if (term) keywordCounts[term] = (keywordCounts[term] || 0) + 1;
        });
      }
    });
    const keywordAnalysis = Object.entries(keywordCounts)
      .map(([term, count]) => ({ term, count }))
      .sort((a, b) => b.count - a.count);

    const storeData = {};
    enrichedProducts.forEach(product => {
      const storeName = product.storeName || 'Unknown Store';
      if (!storeData[storeName]) {
        storeData[storeName] = { name: storeName, productCount: 0, totalSales: 0, totalPrice: 0 };
      }
      storeData[storeName].productCount++;
      storeData[storeName].totalPrice += product.price || 0;
      storeData[storeName].totalSales += product.stats.sales;
    });
    const storeAnalysis = Object.values(storeData)
      .map(store => ({ ...store, averagePrice: store.productCount > 0 ? store.totalPrice / store.productCount : 0 }))
      .sort((a, b) => b.totalSales - a.totalSales);
      
    const productTypeCounts = {};
    enrichedProducts.forEach(product => {
        if (product.productType) productTypeCounts[product.productType] = (productTypeCounts[product.productType] || 0) + 1;
    });
    const productTypeAnalysis = Object.entries(productTypeCounts)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count);

    // --- Construct the final payload for the front-end ---
    const finalResponsePayload = {
      products: enrichedProducts, // Send the new enriched products
      topProduct: topProduct,
      analysis: {
        keywords: keywordAnalysis,
        stores: storeAnalysis,
        productTypes: productTypeAnalysis,
      },
      market: {
        saturation: searchResults.numRecs || 0,
      },
    };

    return response.status(200).json(finalResponsePayload);

  } catch (error) {
    console.error('API Error:', error.message);
    return response.status(500).json({ error: error.message });
  }
}