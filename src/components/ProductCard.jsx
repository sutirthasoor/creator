import { Link } from "react-router-dom";
import ProductMedia from "./ProductMedia.jsx";
import Price from "./Price.jsx";

export default function ProductCard({ product }) {
  return (
    <Link className="cm-pcard" to={`/products/${product.handle}`} aria-label={`${product.title}, view details`}>
      <div className="cm-pcard-media">
        <ProductMedia image={product.image} title={product.title} width={640} />
        {!product.availableForSale && <span className="cm-badge cm-badge-out">Sold out</span>}
      </div>
      <div className="cm-pcard-body">
        {product.productType && <span className="cm-pcard-type">{product.productType}</span>}
        <h3 className="cm-pcard-title">{product.title}</h3>
        <Price price={product.price} maxPrice={product.maxPrice} compareAtPrice={product.compareAtPrice} />
      </div>
    </Link>
  );
}
