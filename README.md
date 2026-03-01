# Orders CRM - E-commerce Backend

A comprehensive Strapi-based e-commerce backend system with order management, product catalog, analytics, and authentication.

## 🎯 Features

- **Order Management**: Complete order lifecycle with stock validation
- **Product Catalog**: Product management with inventory tracking
- **Analytics System**: Real-time analytics for orders, products, and revenue
- **Authentication & Authorization**: JWT-based auth with role-based access control (Customer, Manager, Admin)
- **Order Items**: Detailed order item tracking with product relationships

## 📋 API Endpoints

### Orders API
- `GET /api/orders` - List orders (filtered by user role)
- `POST /api/orders/place` - Place a new order
- `GET /api/orders/:id` - Get order details

### Products API
- `GET /api/products` - List products (public)
- `POST /api/products` - Create product (Manager/Admin only)
- `PUT /api/products/:id` - Update product (Manager/Admin only)

### Analytics API
- `GET /api/analytics/orders` - Order analytics (Admin only)
- `GET /api/analytics/products` - Product analytics (Admin only)
- `GET /api/analytics/revenue` - Revenue analytics (Admin only)

### Authentication API
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/users/me` - Get user profile

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- PostgreSQL/MySQL/SQLite database

### Installation

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/orders-crm.git
cd orders-crm
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Start the development server:

4. Start the development server:
```bash
npm run develop
```

The admin panel will be available at `http://localhost:1337/admin`

## 📖 Documentation

- [Backend Implementation Guide](./BACKEND_IMPLEMENTATION_GUIDE.md) - Detailed backend development guide
- [Frontend Integration Guide](./FRONTEND_INTEGRATION_GUIDE.md) - How to integrate with frontend applications
- [Quick Start Analytics](./QUICK_START_ANALYTICS.md) - Analytics system quick start guide

## 🏗️ Project Structure

```
├── src/
│   ├── api/              # API endpoints
│   │   ├── order/        # Order management
│   │   ├── product/      # Product catalog
│   │   ├── order-item/   # Order items
│   │   └── analytic/     # Analytics system
│   ├── extensions/       # Strapi extensions
│   └── index.ts          # Application entry point
├── config/               # Configuration files
├── database/             # Database migrations
└── .kiro/
    └── specs/            # Feature specifications
        ├── order-stock-validation/
        └── strapi-auth-system/
```

## 🔐 Authentication & Authorization

The system implements a three-tier role-based access control:

- **Customer**: Can view own orders, browse products, manage own profile
- **Manager**: Can manage all orders, products, and inventory
- **Admin**: Full system access including user management and analytics

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```

## 🚀 Deployment

### Strapi Cloud
```bash
npm run deploy
```

### Manual Deployment
See the [Strapi deployment documentation](https://docs.strapi.io/dev-docs/deployment) for various deployment options.

## 📊 Specs & Implementation Plans

This project uses spec-driven development. All feature specifications are located in `.kiro/specs/`:

- **order-stock-validation**: Stock validation during order placement
- **strapi-auth-system**: Authentication and authorization system

Each spec includes:
- Requirements document
- Design document  
- Implementation tasks

## 🛠️ Development Commands

## 🛠️ Development Commands

### `develop`
Start development server with autoReload:
```bash
npm run develop
```

### `start`
Start production server:

### `start`
Start production server:
```bash
npm run start
```

### `build`
Build admin panel:
```bash
npm run build
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 📚 Learn More About Strapi

- [Resource center](https://strapi.io/resource-center) - Strapi resource center.
- [Strapi documentation](https://docs.strapi.io) - Official Strapi documentation.
- [Strapi tutorials](https://strapi.io/tutorials) - List of tutorials made by the core team and the community.
- [Strapi blog](https://strapi.io/blog) - Official Strapi blog containing articles made by the Strapi team and the community.
- [Changelog](https://strapi.io/changelog) - Find out about the Strapi product updates, new features and general improvements.

Feel free to check out the [Strapi GitHub repository](https://github.com/strapi/strapi). Your feedback and contributions are welcome!

## ✨ Community

- [Discord](https://discord.strapi.io) - Come chat with the Strapi community including the core team.
- [Forum](https://forum.strapi.io/) - Place to discuss, ask questions and find answers, show your Strapi project and get feedback or just talk with other Community members.
- [Awesome Strapi](https://github.com/strapi/awesome-strapi) - A curated list of awesome things related to Strapi.

---

<sub>🤫 Psst! [Strapi is hiring](https://strapi.io/careers).</sub>
