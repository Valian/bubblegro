'use strict'
var _ = require('lodash');

class Item {
    constructor(allegroItem, eventType){
        this.eventType = eventType;
        this.setImageUrl(allegroItem);
        this.setItemId(allegroItem.itemInfo);
        this.setLocation(allegroItem.itemInfo);
        this.setPrice(allegroItem.itemInfo);
        this.setTitle(allegroItem.itemInfo);        
    }
    
    static get TypeId(){
        return {
            MINIATURE: 1,
            MEDIUM: 2,
            ORIGINAL: 3
            };
    }
    
    setTitle(itemInfo){
        this.title = itemInfo.itName;   
    }
    
    setImageUrl(allegroItem){
        if(allegroItem.itemImages==null){
            this.imageUrl = "";
        } else if(allegroItem.itemImages.item.length > 0){            
            this.imageUrl = allegroItem.itemImages.item[0].imageUrl;
        }        
    }
    
    setLocation(itemInfo){
        this.location = itemInfo.itLocation; 
    }
    
    setPrice(itemInfo){
        if(itemInfo.itBuyNowPrice > 0){
            this.price = itemInfo.itBuyNowPrice;
        } else if(itemInfo.itPrice > 0){
            this.price = itemInfo.itPrice;
        }
    }
    
    setItemId(itemInfo) {
        this.itemId = itemInfo.itId;
        
    }    
}

module.exports = Item;